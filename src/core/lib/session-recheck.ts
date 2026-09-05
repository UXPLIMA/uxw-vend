/**
 * When a signed-in token has to be re-read from the database.
 *
 * Under the JWT strategy nothing about a session lives server-side: the
 * cookie carries the user id, the role and the priority, and Auth.js hands
 * that back on every request without asking the database anything. So every
 * decision made from the token - is this account still allowed in, is this
 * still an admin, is this device still signed in - is only as fresh as the
 * last time the `jwt` callback actually looked.
 *
 * It looked once. The callback refreshed ban and revocation state under
 * `trigger === "update" || !token.role || token.rolePriority === undefined`,
 * and the credentials provider returns `role: user.role?.name || "member"`
 * with `rolePriority ?? 0`, so both are set the moment anyone signs in and
 * neither is ever falsy again. `trigger` is "update" only when the client
 * calls `update()` itself; a plain request carries no trigger at all (see
 * `session()` in @auth/core, which passes one only when isUpdate). The
 * config asked `session.updateAge` to force an hourly refresh, but Auth.js
 * reads updateAge in the database-session branch only - under `jwt` it is
 * dead config.
 *
 * The result was that banning an account, anonymising it under the right to
 * be forgotten, demoting an admin, and revoking a session all took effect
 * on the next sign-in rather than the next request: up to thirty days for a
 * session that ticked "keep me signed in". The sessions screen offers "sign
 * out this device" and "sign out everywhere", both of which set
 * `UserSession.isRevoked`, and that column was read in exactly one place -
 * the block that no longer ran.
 *
 * Re-reading on literally every request would put a query in front of every
 * page and every API call, which is what the original condition was avoiding.
 * So the token records when it was last checked and is checked again once
 * that stamp is older than the interval below: a bounded staleness, stated
 * in one place, instead of an unbounded one nothing stated at all.
 */

/** How long a token may go without the database being consulted. */
export const SESSION_RECHECK_INTERVAL_SECONDS = 60;

export interface RecheckableToken {
    role?: unknown;
    rolePriority?: unknown;
    /** Epoch milliseconds of the last successful database check. */
    checkedAt?: unknown;
}

/**
 * True when the `jwt` callback must consult the database for this token.
 *
 * A token with no stamp is always checked: it was either minted before this
 * existed, or it came back from an impersonation swap that did not stamp one.
 */
export function shouldRecheckSession(
    token: RecheckableToken | null | undefined,
    trigger?: string,
    now: number = Date.now(),
): boolean {
    if (trigger === "update") return true;
    if (!token) return true;
    if (!token.role || token.rolePriority === undefined) return true;
    const checkedAt = token.checkedAt;
    if (typeof checkedAt !== "number" || !Number.isFinite(checkedAt)) return true;
    // A stamp in the future is a clock that moved; check now rather than
    // trusting it until the clock catches up.
    if (checkedAt > now) return true;
    return now - checkedAt >= SESSION_RECHECK_INTERVAL_SECONDS * 1000;
}
