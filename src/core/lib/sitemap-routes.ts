/**
 * What the sitemap and robots.txt agree to publish.
 *
 * Both files used to keep their own list, and they disagreed: the sitemap
 * submitted `/auth/login` and `/auth/register` while robots.txt disallowed
 * `/auth`, which is the shape Search Console reports as "indexed, though
 * blocked". They share the lists here instead.
 *
 * The other half of the problem was what the sitemap left out. Core ships no
 * pages of its own beyond the home and activity screens: on this platform the
 * content is the modules, and a module only reached the sitemap by declaring a
 * `seo` contributor, which none of the first-party ones do. Every static page
 * an enabled module routes is published now; a contributor is still how a
 * module adds the URLs core cannot know, like one per product.
 */

/** Path prefixes robots.txt tells crawlers to skip. */
export const DISALLOWED_PREFIXES = ["/admin", "/api", "/auth", "/profile"] as const;

export interface CoreStaticRoute {
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
    priority: number;
}

/** Pages core routes itself, with no module involved. */
export const CORE_STATIC_ROUTES: CoreStaticRoute[] = [
    { path: "/", changeFrequency: "daily", priority: 1.0 },
    { path: "/activity", changeFrequency: "daily", priority: 0.6 },
];

export function isCrawlable(path: string): boolean {
    return !DISALLOWED_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
}

export interface RouteLike {
    path: string;
    module: string;
    isAdmin?: boolean;
    /** The module asked for this page to stay out of search results. */
    noindex?: boolean;
}

/**
 * Static public pages contributed by enabled modules.
 *
 * A path with a dynamic segment is skipped: core knows the pattern
 * (`/player/[username]`) and not the values, so listing it would submit a URL
 * that 404s. Those belong to the module's own `seo` contributor.
 */
export function staticModuleRoutes(
    routes: readonly RouteLike[],
    enabled: Record<string, boolean>,
): string[] {
    const paths = new Set<string>();
    for (const route of routes) {
        if (route.isAdmin) continue;
        if (route.noindex) continue;
        if (enabled[route.module] !== true) continue;
        if (!route.path.startsWith("/")) continue;
        if (route.path.includes("[")) continue;
        if (!isCrawlable(route.path)) continue;
        paths.add(route.path);
    }
    return [...paths].sort();
}
