
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

        // Handle catch-all routes [...param]
        if (route.path.includes("[...")) {
            const prefix = route.path.replace(/\/\[\.\.\..*?\]$/, "");
            if (urlPath.startsWith(prefix + "/")) {
                const rest = urlPath.substring(prefix.length + 1);
                const paramName = route.path.match(/\[\.\.\.(\w+)\]/)?.[1] || "params";
                return {
                    key: route.key,
                    module: route.module,
                    params: { [paramName]: rest }
                };
            }
            continue;
        }

        // Convert route pattern to regex for single dynamic segments
        // /blog/[slug] -> ^\/blog\/(?<slug>[^/]+)$
        const pattern = route.path
            .replace(/\//g, "\\/")
            .replace(/\[(\w+)\]/g, "(?<$1>[^/]+)");

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
