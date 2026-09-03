/**
 * One place that turns a manifest path into an admin URL.
 *
 * Manifests describe admin destinations relative to the panel: a module that
 * wants `/admin/vote-sites` writes `/vote-sites`, and core adds the prefix.
 * The registry generator, however, stores the finished path for
 * `adminRoutes`, so `ModuleRoutes[].path` is already absolute while
 * `menu[].path` and `settingsCards[].href` are not.
 *
 * Adding the prefix by hand at each call site is what produced
 * `/admin/admin/vote-sites` in the admin spotlight: a link to a page that does
 * not exist, from a search result for a page that does. This function is
 * idempotent, so both shapes arrive at the same URL.
 */
export function adminHref(path: string): string {
    const trimmed = path.trim();
    if (trimmed === "" || trimmed === "/") return "/admin";
    const absolute = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (absolute === "/admin" || absolute.startsWith("/admin/")) return absolute;
    return `/admin${absolute}`;
}
