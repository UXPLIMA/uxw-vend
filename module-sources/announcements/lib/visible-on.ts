/**
 * Where an announcement is allowed to appear.
 *
 * The admin screen offers two rules, `includePages` and `excludePages`, each
 * a comma separated list of paths with `*` as the wildcard. They reached
 * nothing: the banner in the site's layout never read them and neither did
 * the page builder block, while the one component that implemented them was
 * imported by nobody. An operator who limited a notice to the store saw it on
 * every page, and the setting looked like it worked.
 *
 * The admin panel is the default those rules do not have to spell out. A
 * message written for visitors was being drawn above a panel that starts at
 * the top of the window, so the sidebar covered half of it and the screen
 * opened on a clipped sentence. The panel is a tool rather than a page of the
 * site, so a banner reaches it only when `includePages` names it.
 */

/** What the rules are written against: the path without the locale segment. */
export function pathWithoutLocale(pathname: string): string {
    return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
}

/**
 * A pattern is a path with `*` in it, not a regular expression. Everything
 * else is escaped, so `/store/cart` matches that and not `/storeXcart`.
 */
function matchPattern(path: string, pattern: string): boolean {
    if (pattern === "/*" || pattern === "*") return true;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(path);
}

function list(value: string | null | undefined): string[] {
    return (value ?? "").split(",").map((p) => p.trim()).filter(Boolean);
}

export interface PageRules {
    includePages?: string | null;
    excludePages?: string | null;
}

export function isVisibleOnPage(rules: PageRules, pathname: string): boolean {
    const path = pathWithoutLocale(pathname);
    const include = list(rules.includePages);
    const exclude = list(rules.excludePages);

    if (include.length > 0) {
        if (!include.some((pattern) => matchPattern(path, pattern))) return false;
    } else if (path === "/admin" || path.startsWith("/admin/")) {
        return false;
    }

    return !exclude.some((pattern) => matchPattern(path, pattern));
}
