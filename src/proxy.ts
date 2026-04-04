import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './core/lib/i18n/config';
import { moduleRouteMap } from '@/core/generated/module-routes';

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

    // Use the current request's origin to build the internal API URL
    const origin = request.nextUrl.origin;
    try {
        const res = await fetch(`${origin}/api/v1/modules/status`);
        if (res.ok) {
            const data = await res.json();
            moduleCache = new Map(Object.entries(data.modules || {}));
            cacheUpdatedAt = now;
            return moduleCache.get(moduleId) ?? true;
        }
    } catch {
        // If API fails, default to enabled
    }

    return true;
}

export async function proxy(request: NextRequest) {
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
        return intlMiddleware(request);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Match all pathnames except for
        // - static files
        // - _next internal routes
        '/((?!_next|_vercel|.*\\..*).*)'
    ]
};
