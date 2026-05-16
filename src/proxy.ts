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
import { getClientIP } from '@/core/lib/rate-limit';

const intlMiddleware = createIntlMiddleware({
    locales: locales,
    defaultLocale: defaultLocale,
    localePrefix: 'always'
});

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
 * Use the shared trust-aware client IP helper from rate-limit.ts so
 * TRUSTED_PROXY_IPS is honored uniformly. A prior inline version trusted
 * x-forwarded-for unconditionally, which let attackers behind any proxy
 * spoof their IP to bypass /admin/ip-blocks rules.
 */
function getClientIpFromRequest(request: NextRequest): string {
    return getClientIP(request.headers);
}

function resolveIpScope(pathname: string): IpBlockScope {
    if (/^\/[a-z]{2}\/admin(\/|$)/.test(pathname)) return 'admin';
    if (pathname.startsWith('/api/v1/admin')) return 'admin';
    if (pathname.startsWith('/api/')) return 'api';
    return 'all';
}

function isStaticAsset(pathname: string): boolean {
    return (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/_vercel') ||
        pathname.includes('.')
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

    // ===== CSRF gate =====
    // NextAuth handles /api/auth/* itself; inbound webhooks are exempt because
    // external services POST them without a browser origin. Everything else
    // gets a same-origin check to prevent cross-site cookie-riding attacks.
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

    const moduleId = getModuleForPath(pathname);

    if (moduleId) {
        const isEnabled = await getModuleEnabled(moduleId);

        if (!isEnabled) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Module not enabled', module: moduleId },
                    { status: 404 }
                );
            }

            const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] || 'en';
            const url = new URL(`/${locale}/not-found`, request.url);
            return NextResponse.rewrite(url, { status: 404 });
        }
    }

    // ===== Setup wizard gate =====
    // Force every visitor through the wizard until at least one user exists.
    // The setup API itself stays reachable so the wizard can post back.
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

    // ===== Maintenance mode gate =====
    // Admins (and any allowlisted roles) keep access. Auth endpoints stay open
    // so admins can sign in; the maintenance toggle API stays open so they can
    // turn it off; the internal module-status API is exempt to avoid a loop.
    if (!isStaticAsset(pathname)) {
        const locale = extractLocale(pathname);
        const maintenancePath = `/${locale}/maintenance`;
        const authPrefix = `/${locale}/auth`;
        const isOnMaintenancePage =
            pathname === maintenancePath || pathname.startsWith(`${maintenancePath}/`);
        const isOnAuthPage = pathname.startsWith(authPrefix);
        const isSetupPath =
            pathname === `/${locale}/setup` || pathname.startsWith(`/${locale}/setup/`);
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

    // ===== IP blocklist gate =====
    // Block list is cached in-process for 60s. `isIpBlocked` fails open on DB
    // errors — a DB outage must never lock every visitor out. Skipped until
    // setup completes so a stale rule can't lock the operator out of the
    // initial install screen before they whitelist their own IP.
    if (!isStaticAsset(pathname) && (await isSetupComplete())) {
        const clientIp = getClientIpFromRequest(request);
        const ipScope = resolveIpScope(pathname);
        try {
            if (await isIpBlocked(clientIp, ipScope)) {
                return new NextResponse('Access denied', { status: 403 });
            }
        } catch {
            // Fail-open: a loader error must not block visitors.
        }
    }

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
    // Bind the correlation id to async-local context so every nested log call
    // (including those inside module hooks and awaited handlers) auto-tags
    // its output with this id. See core/lib/logger.ts.
    const correlationId = request.headers.get('x-correlation-id') || randomUUID();
    return runWithLogContext({ correlationId }, () => proxyImpl(request, correlationId));
}

export const config = {
    matcher: [
        '/((?!_next|_vercel|.*\\..*).*)'
    ]
};
