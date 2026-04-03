import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './core/lib/i18n/config';

// Create the i18n middleware
const intlMiddleware = createIntlMiddleware({
    locales: locales,
    defaultLocale: defaultLocale,
    localePrefix: 'always'
});

// Module route patterns - modules can be disabled
const moduleRoutes: Record<string, RegExp[]> = {
    store: [
        /^\/[a-z]{2}\/store/,
        /^\/[a-z]{2}\/cart/,
        /^\/[a-z]{2}\/checkout/,
        /^\/[a-z]{2}\/admin\/store/,
        /^\/api\/v1\/store/,
        /^\/api\/v1\/products/,
        /^\/api\/v1\/cart/,
    ],
    forum: [
        /^\/[a-z]{2}\/forum/,
        /^\/[a-z]{2}\/admin\/forum/,
        /^\/api\/v1\/forum/,
    ],
    blog: [
        /^\/[a-z]{2}\/blog/,
        /^\/[a-z]{2}\/admin\/blog/,
        /^\/api\/v1\/blog/,
    ],
    tickets: [
        /^\/[a-z]{2}\/support/,
        /^\/[a-z]{2}\/admin\/tickets/,
        /^\/api\/v1\/tickets/,
    ],
    'help-center': [
        /^\/[a-z]{2}\/help/,
        /^\/[a-z]{2}\/admin\/help/,
        /^\/api\/v1\/help/,
    ],
};

// Check if a path belongs to a disabled module
function getModuleForPath(pathname: string): string | null {
    for (const [moduleId, patterns] of Object.entries(moduleRoutes)) {
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
const CACHE_TTL = 60 * 1000; // 1 minute

async function getModuleEnabled(moduleId: string): Promise<boolean> {
    const now = Date.now();

    // Check cache
    if (now - cacheUpdatedAt < CACHE_TTL && moduleCache.has(moduleId)) {
        return moduleCache.get(moduleId) ?? true;
    }

    // In proxy, we can't use Prisma directly (edge runtime limitations)
    // We'll use a simple API endpoint to check module status
    // For now, default to enabled if we can't check
    try {
        const res = await fetch(`${process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/v1/modules/status`);
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
        const isEnabled = await getModuleEnabled(moduleId);

        if (!isEnabled) {
            // For API routes, return 404 JSON
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Module not enabled', module: moduleId },
                    { status: 404 }
                );
            }

            // For pages, redirect to 404
            const url = new URL('/not-found', request.url);
            return NextResponse.rewrite(url);
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
