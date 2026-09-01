
import { ModuleApiRoutes } from "@/core/generated/module-registry";
import { isDynamicPattern, matchPathPattern } from "@/core/lib/path-pattern";

export interface ApiRouteMatch {
    key: string;
    module: string;
    params: Record<string, string>;
    method?: string;
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
            method: exactMatch.method
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
                method: route.method
            };
        }
    }

    return null;
}
