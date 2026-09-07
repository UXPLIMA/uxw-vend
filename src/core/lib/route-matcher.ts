
import { cache } from "react";
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

/**
 * One match per request, shared by everything that asks.
 *
 * A dynamic module page asks twice: `generateMetadata` runs first and the page
 * component runs after, and each called `matchModuleRoute(slug)` for itself.
 * Two calls, two `RouteMatch` objects, two `params` objects - and the
 * `routeExists` memo downstream is a React `cache`, which keys on argument
 * identity. Handed a fresh object each time it never hit, so the resolver that
 * decides whether the page exists ran on every ask, and the comment beside it
 * saying `cache` "keeps it to one call per request" was describing an
 * intention rather than what happened. Measured against the development server
 * with five thousand articles: one article page ran the same
 * `select id from BlogArticle where slug = ? and status = ?` eight times.
 *
 * The key here is the joined path, a string, because that is what a memo can
 * compare. Both asks then get the identical object, which makes the memo below
 * it hit as well.
 */
export const matchModuleRouteOnce = cache((urlPath: string): RouteMatch | null =>
    matchModuleRoute(urlPath.split("/").filter(Boolean)),
);
