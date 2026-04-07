
import { ModuleApiRoutes } from "@/core/generated/module-registry";

export interface ApiRouteMatch {
    key: string;
    module: string;
    params: Record<string, string>;
    method?: string;
}

export function matchApiRoute(pathSegments: string[]): ApiRouteMatch | null {
    // Construct path relative to /api/v1
    // if url is /api/v1/blog/articles -> pathSegments = ['blog', 'articles'] -> /blog/articles
    const urlPath = "/" + pathSegments.join("/");

    // Check for exact matches
    const exactMatch = ModuleApiRoutes.find(r => r.path === urlPath);
    if (exactMatch) {
        return {
            key: exactMatch.key,
            module: exactMatch.module,
            params: {},
            method: exactMatch.method
        };
    }

    // Check for dynamic matches
    for (const route of ModuleApiRoutes) {
        if (!route.path.includes("[")) continue;

        const pattern = route.path
            .replace(/\//g, "\\/")
            .replace(/\[(.*?)\]/g, "(?<$1>[^/]+)");

        const regex = new RegExp(`^${pattern}$`);
        const match = urlPath.match(regex);

        if (match) {
            return {
                key: route.key,
                module: route.module,
                params: match.groups || {},
                method: route.method
            };
        }
    }

    return null;
}
