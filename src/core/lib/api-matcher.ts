
import { ModuleApiRoutes } from "@/core/generated/module-registry";
import { isDynamicPattern, matchPathPattern } from "@/core/lib/path-pattern";

export interface ApiRouteMatch {
    key: string;
    module: string;
    params: Record<string, string>;
    method?: string;
    /** An endpoint an external service posts to, with no browser behind it. */
    providerCallback?: boolean;
    /** A stricter limit the manifest asked for, if it asked for one. */
    rateLimit?: { maxRequests: number; windowMs: number };
}

export function matchApiRoute(pathSegments: string[]): ApiRouteMatch | null {
    // Path is relative to /api/v1: /api/v1/blog/articles arrives here as
    // ['blog', 'articles'] and is matched as /blog/articles.
    const urlPath = "/" + pathSegments.join("/");

    const exactMatch = ModuleApiRoutes.find(r => r.path === urlPath);
    if (exactMatch) {
        return {
            key: exactMatch.key,
            module: exactMatch.module,
            params: {},
            method: exactMatch.method,
            providerCallback: exactMatch.providerCallback,
            rateLimit: exactMatch.rateLimit,
        };
    }

    for (const route of ModuleApiRoutes) {
        if (!isDynamicPattern(route.path)) continue;

        const match = matchPathPattern(route.path, urlPath);
        if (match) {
            return {
                key: route.key,
                module: route.module,
                params: match.params,
                method: route.method,
                providerCallback: route.providerCallback,
                rateLimit: route.rateLimit,
            };
        }
    }

    return null;
}
