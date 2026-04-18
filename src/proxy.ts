import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './core/lib/i18n/config';
import { moduleRouteMap } from '@/core/generated/module-routes';
import { randomUUID } from 'crypto';
import { isSetupComplete } from '@/core/lib/setup-state';
import { getMaintenanceConfig } from '@/core/lib/maintenance';
import { auth } from '@/core/lib/auth';
import prisma from '@/core/lib/db';
import { isIpBlocked, type IpBlockScope } from '@/core/lib/ip-blocks';
import { getModuleStates } from '@/core/lib/module-cache';
import { checkCsrf } from '@/core/lib/csrf';
import { runWithLogContext } from '@/core/lib/logger';

// Create the i18n middleware
const intlMiddleware = createIntlMiddleware({
    locales: locales,
    defaultLocale: defaultLocale,
    localePrefix: 'always'
});

// Check if a path belongs to a disabled module
function getModuleForPath(pathname: string): string | null {
    for (const [moduleId, patterns] of Object.entries(moduleRouteMap)) {
        for (const pattern of patterns) {
            if (pattern.test(pathname)) {
                return moduleId;
            }
        }
    }
    return null;
}

/**
 * Resolve a single module's enabled flag. We hit the shared module state
 * cache directly (Redis when available, in-memory fallback) — no internal
 * HTTP round-trip. Next.js 16 runs middleware in Node runtime so direct
 * Prisma reads via getModuleStates are safe here.
 *
 * Unknown module IDs default to "enabled" — a module that has routes in the
 * registry but no ModuleConfig row is assumed on until an admin toggles it
 * off. Failing open is preferable to black-holing traffic during a DB blip.
 */
async function getModuleEnabled(moduleId: string): Promise<boolean> {
    try {
        const states = await getModuleStates();
        return states[moduleId] ?? true;
    } catch {
        return true;
    }
}

function extractLocale(pathname: string): string {
    const match = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
    if (match && (locales as readonly string[]).includes(match[1])) {
        return match[1];
    }
    return defaultLocale;
}

/**
 * Extract the caller's IP using the same header precedence as
 * core/lib/rate-limit.ts (x-forwarded-for → x-real-ip → "unknown").
 * Kept inline here so the middleware can stay self-contained.
 */
function getClientIpFromRequest(request: NextRequest): string {
    const xff = request.headers.get('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0]?.trim();
        if (first) return first;
    }
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
    return 'unknown';
}

function resolveIpScope(pathname: string): IpBlockScope {
    // Admin UI under /{locale}/admin
    if (/^\/[a-z]{2}\/admin(\/|$)/.test(pathname)) return 'admin';
    // Admin APIs
    if (pathname.startsWith('/api/v1/admin')) return 'admin';
    // Any API route
    if (pathname.startsWith('/api/')) return 'api';
    return 'all';
}

function isStaticAsset(pathname: string): boolean {
    return (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/_vercel') ||
        pathname.includes('.') // files with extensions (images, css, js, etc.)
    );
}

/**
 * Best-effort session-role extraction for middleware gating.
 * Returns "guest" when there is no session or when the lookup fails so
 * the caller can safely treat them as an unprivileged visitor.
 */
async function getSessionRole(request: NextRequest): Promise<string> {
    const cookieHeader = request.headers.get('cookie') || '';
    if (
        !cookieHeader.includes('authjs.session-token') &&
        !cookieHeader.includes('next-auth.session-token')
    ) {
        return 'guest';
    }

    try {
        const session = await auth();
        const userId = session?.user?.id;
        if (!userId) return 'guest';
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: { select: { name: true } } },
        });
        return user?.role?.name || 'guest';
    } catch {
        return 'guest';
    }
}

async function proxyImpl(request: NextRequest, correlationId: string): Promise<NextResponse> {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-correlation-id', correlationId);

    const { pathname } = request.nextUrl;

    // ==================== CSRF GATE ====================
    // State-changing API calls must come from an allowed origin. NextAuth's
    // own endpoints (/api/auth/*) handle CSRF internally; inbound webhooks
    // (/api/v1/webhook/*, /api/webhook/*) are exempt since external services
    // POST them without a browser origin. Everything else goes through the
    // same-origin check so an attacker's site cannot ride a victim's cookies
    // to a mutating endpoint.
    if (
        pathname.startsWith('/api/') &&
        !pathname.startsWith('/api/auth/') &&
        !pathname.startsWith('/api/v1/webhook/') &&
        !pathname.startsWith('/api/webhook/')
    ) {
        const csrf = checkCsrf(request);
        if (!csrf.ok) {
            return NextResponse.json(
                { ok: false, error: 'Origin not allowed', code: 'csrf_rejected' },
                { status: 403 },
            );
        }
    }

    // Check if path belongs to a module
    const moduleId = getModuleForPath(pathname);

    if (moduleId) {
        const isEnabled = await getModuleEnabled(moduleId);

        if (!isEnabled) {
            // For API routes, return 404 JSON
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Module not enabled', module: moduleId },
                    { status: 404 }
                );
            }

            // For pages, return 404 response
            const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] || 'en';
            const url = new URL(`/${locale}/not-found`, request.url);
            return NextResponse.rewrite(url, { status: 404 });
        }
    }

    // ==================== SETUP WIZARD GATE ====================
    // If the platform hasn't been set up yet (no users exist), force every
    // visitor through the setup wizard. The setup API route itself remains
    // reachable so the wizard can function.
    if (!isStaticAsset(pathname) && !pathname.startsWith('/api/setup')) {
        const setupDone = await isSetupComplete();
        if (!setupDone) {
            const locale = extractLocale(pathname);
            const setupPath = `/${locale}/setup`;
            const isAlreadyOnSetup =
                pathname === setupPath || pathname.startsWith(`${setupPath}/`);

            if (!isAlreadyOnSetup) {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json(
                        { error: 'Setup required', redirectTo: setupPath },
                        { status: 503 }
                    );
                }
                const url = new URL(setupPath, request.url);
                return NextResponse.rewrite(url);
            }
        }
    }

    // ==================== MAINTENANCE MODE GATE ====================
    // After setup is complete, enforce maintenance mode. Admins (and any
    // explicitly allowlisted roles) can still browse. Auth endpoints remain
    // accessible so admins can sign in. Internal API routes used by the
    // proxy itself (module status) and auth API routes are always exempt.
    if (!isStaticAsset(pathname)) {
        const locale = extractLocale(pathname);
        const maintenancePath = `/${locale}/maintenance`;
        const authPrefix = `/${locale}/auth`;
        const isOnMaintenancePage =
            pathname === maintenancePath || pathname.startsWith(`${maintenancePath}/`);
        const isOnAuthPage = pathname.startsWith(authPrefix);
        const isSetupPath =
            pathname === `/${locale}/setup` || pathname.startsWith(`/${locale}/setup/`);
        // Auth API routes must stay accessible so admins can sign in.
        // Internal module-status API is used by the proxy itself (avoid circular block).
        // Admin maintenance API must stay accessible so admins can toggle the setting.
        const isAuthApi = pathname.startsWith('/api/auth');
        const isInternalApi = pathname === '/api/v1/modules/status';
        const isMaintenanceApi = pathname === '/api/v1/admin/maintenance';

        if (
            !isOnMaintenancePage && !isOnAuthPage && !isSetupPath &&
            !isAuthApi && !isInternalApi && !isMaintenanceApi
        ) {
            const config = await getMaintenanceConfig();
            if (config.enabled) {
                const allowedRoles = config.allowedRoles?.length
                    ? config.allowedRoles
                    : ['admin'];
                const role = await getSessionRole(request);

                if (!allowedRoles.includes(role)) {
                    if (pathname.startsWith('/api/')) {
                        return NextResponse.json(
                            { error: 'Service Unavailable', maintenance: true },
                            { status: 503 }
                        );
                    }
                    const url = new URL(maintenancePath, request.url);
                    return NextResponse.rewrite(url, { status: 503 });
                }
            }
        }
    }

    // ==================== IP BLOCKLIST GATE ====================
    // After setup and maintenance checks, refuse any request whose
    // source IP is in the active IpBlock list for the request's scope.
    // The block list is cached in-process for 60s so middleware stays
    // fast, and `isIpBlocked` fails open on DB errors — a DB outage
    // must never lock every visitor out.
    //
    // IP gating is skipped until setup is complete: during the bootstrap
    // wizard the admin hasn't had a chance to whitelist their IP yet, and
    // a stale DB rule from a test environment must never lock the operator
    // out of the initial install screen.
    if (!isStaticAsset(pathname) && (await isSetupComplete())) {
        const clientIp = getClientIpFromRequest(request);
        const ipScope = resolveIpScope(pathname);
        try {
            if (await isIpBlocked(clientIp, ipScope)) {
                return new NextResponse('Access denied', { status: 403 });
            }
        } catch {
            // Fail-open: never block due to loader errors.
        }
    }

    // Continue with i18n middleware for non-API routes
    if (!pathname.startsWith('/api/')) {
        const response = intlMiddleware(request);
        response.headers.set('x-correlation-id', correlationId);
        return response;
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-correlation-id', correlationId);
    return response;
}

export async function proxy(request: NextRequest) {
    // Mint the request's correlation id and bind it to an async-local
    // context so any nested `log.info(...)` / `log.error(...)` call —
    // including those running inside module hooks or awaited handlers —
    // automatically tags its output with this id. See core/lib/logger.ts.
    const correlationId = request.headers.get('x-correlation-id') || randomUUID();
    return runWithLogContext({ correlationId }, () => proxyImpl(request, correlationId));
}

export const config = {
    matcher: [
        // Match all pathnames except for
        // - static files
        // - _next internal routes
        '/((?!_next|_vercel|.*\\..*).*)'
    ]
};
