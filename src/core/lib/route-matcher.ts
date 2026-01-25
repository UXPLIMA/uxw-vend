
import { ModuleRoutes } from "@/core/generated/module-registry";

export interface RouteMatch {
    key: string;
    module: string;
    params: Record<string, string>;
}

export function matchModuleRoute(pathSegments: string[]): RouteMatch | null {
    const urlPath = "/" + pathSegments.join("/");

    // Check for exact matches first
    const exactMatch = ModuleRoutes.find(r => r.path === urlPath);
    if (exactMatch) {
        return {
            key: exactMatch.key,
            module: exactMatch.module,
            params: {}
        };
    }

    // Check for dynamic matches
    for (const route of ModuleRoutes) {
        if (!route.path.includes("[")) continue;

        // Convert route pattern to regex
        // /blog/[slug] -> ^\/blog\/([^/]+)$
        const pattern = route.path
            .replace(/\//g, "\\/")
            .replace(/\[(.*?)\]/g, "(?<$1>[^/]+)");

        const regex = new RegExp(`^${pattern}$`);
        const match = urlPath.match(regex);

        if (match) {
            return {
                key: route.key,
                module: route.module,
                params: match.groups || {}
            };
        }
    }

    return null;
}
