/**
 * When this process last read a token's row out of the database.
 *
 * The `jwt` callback bounds how stale a signed-in token may be by stamping
 * `token.checkedAt` and re-reading once the stamp is older than the interval.
 * The stamp is written onto the token object and the token is only written
 * back to the browser by Auth.js's own handlers, and this app reads the
 * session by calling `auth()` from route handlers and from the proxy. So the
 * cookie kept the stamp it was minted with and the recheck fired on every
 * request for the life of that cookie. Measured against the running server by
 * printing every statement of one signed-in `GET /api/v1/users/me` past the
 * interval: nine statements, of which four are the recheck - the user row, its
 * role, the session row's revocation flag and the last-active write - and no
 * `Set-Cookie` on the response to carry a fresh stamp back.
 *
 * A process-local stamp survives where the token's does not, and it allows
 * exactly the staleness that was already agreed: each worker re-reads a given
 * token at most once per interval. A worker that has never seen the token
 * reads it, which is the right answer for a fresh instance.
 *
 * This is deliberately not Redis. The question it answers is "have I, this
 * process, looked recently", the cost of being wrong is one extra read, and a
 * network round trip per request to save a database round trip per minute is
 * the wrong trade.
 */

/**
 * The map lives on `globalThis` for the reason `maintenance.ts` records: the
 * proxy and the API route chunks are separate Turbopack bundles, so a
 * module-level `const` gives each of them its own copy. Measured with three
 * copies in play, one signed-in request still cost three rechecks - the proxy
 * marked its own map and the route never saw it.
 */
const GLOBAL_KEY = "__blysis_session_checked_at__" as const;

function store(): Map<string, number> {
    const g = globalThis as unknown as Record<string, Map<string, number> | undefined>;
    if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map<string, number>();
    return g[GLOBAL_KEY];
}

/** How often the map is swept. The window it sweeps is passed in by the caller. */
const SWEEP_INTERVAL_MS = 60_000;

/** How long an entry is kept past its usefulness before a sweep drops it. */
const SWEEP_KEEP_MS = 5 * 60_000;

export function markChecked(tokenId: string, at: number = Date.now()): void {
    store().set(tokenId, at);
}

/**
 * Has this process read the token's row within `withinMs`?
 *
 * A stamp in the future is a clock that moved and is not trusted, the same
 * answer `shouldRecheckSession` gives to the same situation.
 */
export function wasCheckedWithin(tokenId: string, withinMs: number, now: number = Date.now()): boolean {
    const at = store().get(tokenId);
    if (at === undefined) return false;
    if (at > now) return false;
    return now - at < withinMs;
}

/** Drop what this process knows about one token. */
export function forgetChecked(tokenId: string): void {
    store().delete(tokenId);
}

/** Drop every entry older than `keepMs`. Returns how many went. */
export function sweepCheckedSessions(keepMs: number, now: number = Date.now()): number {
    const map = store();
    let dropped = 0;
    for (const [tokenId, at] of map) {
        if (now - at >= keepMs) {
            map.delete(tokenId);
            dropped += 1;
        }
    }
    return dropped;
}

/** Test seam: start from an empty map. */
export function clearCheckedSessions(): void {
    store().clear();
}

// One entry per signed-in token this worker has served, and a site's tokens
// outlive their usefulness here in minutes, so the map is swept rather than
// left to follow the login count.
const sweeper = setInterval(() => sweepCheckedSessions(SWEEP_KEEP_MS), SWEEP_INTERVAL_MS);
// Nothing should be kept alive by this: a script that imports the auth config
// must still be able to exit.
sweeper.unref?.();
