
/**
 * The `<title>` core gives a page it renders on a module's behalf.
 *
 * A module page is a component in a registry, not a route segment file, so it
 * cannot export `generateMetadata`; core's catch-all does that for it. Core
 * used to build the title out of the last URL segment, which is right only
 * when the URL is known to name something real.
 *
 * On a route whose page resolves server-side and calls `notFound()`, it is:
 * the response is a 404 and Next replaces this metadata with the not-found
 * page's. On a route whose page answers 200 and renders "not found" in the
 * browser, it is not. `/store/product/999999/free-nitro-generator` came back
 * 200 with `<title>`, `og:title` and `twitter:title` all reading "Free Nitro
 * Generator" beside the site's own name, which is exactly what an unfurled
 * link shows in Discord or Twitter. Any visitor could mint one on the site's
 * domain. With `custom-pages` installed the route is `/[slug]`, so it was
 * every unrecognised URL on the site, not just the ones under a module.
 *
 * So a URL segment names the page only where a module has declared
 * `titleFromPath`, which `validate-module` grants only to a server page that
 * calls `notFound()`. Everywhere else the title comes from the route pattern
 * the module itself declared, which no visitor can influence.
 */

const DYNAMIC_SEGMENT = /^\[.*\]$/;

/** How long a path-derived title may be before it stops looking like a title. */
const MAX_TITLE_LENGTH = 120;

/** "server-launch" -> "Server Launch" */
export function humanizeSegment(segment: string): string {
    return segment
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param slug        the requested path, split into segments
 * @param routePattern the matched route's declared path, e.g. `/store/product/[...params]`
 * @param titleFromPath whether that route declared the URL trustworthy
 */
export function moduleRouteTitle(
    slug: string[] | undefined,
    routePattern?: string,
    titleFromPath?: boolean,
): string {
    if (titleFromPath && slug && slug.length > 0) {
        const fromUrl = humanizeSegment(slug[slug.length - 1]);
        if (fromUrl && fromUrl.length <= MAX_TITLE_LENGTH) return fromUrl;
    }

    if (routePattern) {
        const literal = routePattern
            .split("/")
            .filter((segment) => segment && !DYNAMIC_SEGMENT.test(segment))
            .pop();
        if (literal) {
            const fromRoute = humanizeSegment(literal);
            if (fromRoute) return fromRoute;
        }
    }

    return "Page";
}
