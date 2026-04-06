import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './core/lib/i18n/config';
import { moduleRouteMap } from '@/core/generated/module-routes';
import { randomUUID } from 'crypto';

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

// Cache for module states (avoid DB calls on every request)
let moduleCache: Map<string, boolean> = new Map();
let cacheUpdatedAt = 0;
const CACHE_TTL = 10 * 1000; // 10 seconds

async function getModuleEnabled(moduleId: string, request: NextRequest): Promise<boolean> {
    const now = Date.now();

    // Check cache
    if (now - cacheUpdatedAt < CACHE_TTL && moduleCache.has(moduleId)) {
        return moduleCache.get(moduleId) ?? true;
    }

    // Use hardcoded internal URL to prevent SSRF via Origin header spoofing
    const port = process.env.PORT || '3001';
    const internalUrl = `http://127.0.0.1:${port}/api/v1/modules/status`;
    try {
        const res = await fetch(internalUrl, {
            headers: { 'x-internal-request': '1' },
        });
        if (res.ok) {
            const data = await res.json();
            moduleCache = new Map(Object.entries(data.modules || {}));
            cacheUpdatedAt = now;
            return moduleCache.get(moduleId) ?? true;
        }
    } catch {
        // If API fails, default to enabled
    }

    void request; // consumed for type safety
    return true;
}

export async function proxy(request: NextRequest) {
    // Inject correlation ID for request tracking
    const correlationId = request.headers.get('x-correlation-id') || randomUUID();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-correlation-id', correlationId);

    const { pathname } = request.nextUrl;

    // Check if path belongs to a module
    const moduleId = getModuleForPath(pathname);

    if (moduleId) {
        const isEnabled = await getModuleEnabled(moduleId, request);

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

export const config = {
    matcher: [
        // Match all pathnames except for
        // - static files
        // - _next internal routes
        '/((?!_next|_vercel|.*\\..*).*)'
    ]
};
