/**
 * How long a signed-in session lasts.
 *
 * Auth.js gets one `session.maxAge`, which sets both the cookie's lifetime and
 * the JWT's own expiry. "Keep me signed in" needs two lifetimes, so the cookie
 * is issued at the longer one and the shorter one is stamped onto the token as
 * an absolute deadline that the `jwt` callback enforces on every request. A
 * token past its deadline is dropped the same way a banned user's is.
 *
 * Absolute, not idle: a session that started 24 hours ago on a shared machine
 * ends, however much it was used in between. Ticking the deadline forward on
 * activity would turn the un-remembered case back into a session that never
 * expires as long as someone keeps the tab open.
 */

/** Default when the user did not ask to stay signed in. */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Applied when the user ticked "keep me signed in". */
export const REMEMBERED_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Reads the checkbox off the credentials payload.
 *
 * Everything crossing the Auth.js credentials boundary arrives as a string,
 * and anything that is not an explicit yes is a no.
 */
export function parseRemember(raw: unknown): boolean {
    if (typeof raw === "boolean") return raw;
    if (typeof raw !== "string") return false;
    const value = raw.trim().toLowerCase();
    return value === "true" || value === "1" || value === "on" || value === "yes";
}

/** Epoch milliseconds at which a session minted now must stop working. */
export function sessionExpiresAt(remember: boolean, now: number = Date.now()): number {
    const seconds = remember ? REMEMBERED_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
    return now + seconds * 1000;
}

/**
 * True when a token has passed its stamped deadline.
 *
 * A token with no deadline was issued before this existed; it keeps working
 * until its own cookie expires rather than logging everyone out on deploy.
 */
export function sessionExpired(
    token: { absoluteExpiry?: unknown } | null | undefined,
    now: number = Date.now(),
): boolean {
    const expiry = token?.absoluteExpiry;
    if (typeof expiry !== "number" || !Number.isFinite(expiry)) return false;
    return now >= expiry;
}
