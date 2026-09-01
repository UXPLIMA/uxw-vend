
import { ModuleRoutes } from "@/core/generated/module-registry";
import { isDynamicPattern, matchPathPattern } from "@/core/lib/path-pattern";

export interface RouteMatch {
    key: string;
    module: string;
    params: Record<string, string>;
}

export function matchModuleRoute(pathSegments: string[]): RouteMatch | null {
    const urlPath = "/" + pathSegments.join("/");

    // Static routes win over dynamic ones regardless of declaration order,
    // so /blog/archive is never swallowed by /blog/[slug].
    const exactMatch = ModuleRoutes.find(r => r.path === urlPath);
    if (exactMatch) {
        return {
            key: exactMatch.key,
            module: exactMatch.module,
            params: {}
        };
    }

    for (const route of ModuleRoutes) {
        if (!isDynamicPattern(route.path)) continue;

        const match = matchPathPattern(route.path, urlPath);
        if (match) {
            return {
                key: route.key,
                module: route.module,
                params: match.params
            };
        }
    }

    return null;
}
