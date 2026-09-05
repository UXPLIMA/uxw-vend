
import { ModuleApiRoutes } from "@/core/generated/module-registry";
import { isDynamicPattern, matchPathPattern } from "@/core/lib/path-pattern";

export interface ApiRouteMatch {
    key: string;
    module: string;
    /**
     * The handler file this path resolves to, relative to the module root.
     * Two declared paths may name the same file, so anything counting a
     * caller's requests against an endpoint has to key on this and not on
     * `key`, which is derived from the URL.
     */
    handler: string;
    params: Record<string, string>;
    method?: string;
    /**
     * The verbs the handler file exports, collected by generate-registry.
     * The dispatcher answers OPTIONS and puts an `Allow` on its 405 from
     * this, so neither has to import a handler to know what it accepts.
     */
    methods?: string[];
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
            handler: exactMatch.handler,
            params: {},
            method: exactMatch.method,
            methods: exactMatch.methods,
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
                handler: route.handler,
                params: match.params,
                method: route.method,
                methods: route.methods,
                providerCallback: route.providerCallback,
                rateLimit: route.rateLimit,
            };
        }
    }

    return null;
}
