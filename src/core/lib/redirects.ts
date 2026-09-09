import { applyFiltersAsync } from "./hooks";
import { cached } from "./cache";

/**
 * Where a moved page now lives.
 *
 * An operator renames a page and every link to the old address on every forum
 * and search engine still points at it. Answering that has to happen before
 * anything renders, which is the proxy, which is core - and a module cannot
 * reach in there. So core asks, whoever is installed replies, and core never
 * learns which module answered.
 *
 * The rules are read once and kept for a minute. This runs on every request
 * that is not a static asset, and a database read per request is not a price a
 * site should pay for a feature most of them never use. A minute is also what
 * an operator waits to see a rule they just wrote, which is the other half of
 * the trade.
 */

/** Long enough to be free, short enough that an operator does not doubt it. */
const CACHE_MS = 60_000;

export async function siteRedirects(): Promise<RoutingRedirectRule[]> {
    return cached("uxw:routing:redirects", CACHE_MS, async () =>
        applyFiltersAsync("routing.redirects", [] as RoutingRedirectRule[], {}),
    );
}
