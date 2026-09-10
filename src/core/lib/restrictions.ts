/**
 * Taking something away from a member without taking everything.
 *
 * The only ban this site had was the whole of it: an account is banned and
 * cannot sign in. That is right for somebody who should not be here and wrong
 * for almost every case an operator meets - a member who argues in every
 * ticket, one who cannot stop replying to a thread, one who is fine everywhere
 * except the one place they are not. Banning them outright loses a member;
 * doing nothing loses the room.
 *
 * Two rules decide what a scope means.
 *
 * The whole site includes every part of it. An operator who bans somebody from
 * the site and finds them still commenting has been told a lie by their own
 * admin screen, and that is the shape produced by adding a narrower scope
 * later.
 *
 * A restriction that has run out is not one. The clock is why an operator
 * reaches for this instead of a ban, so a lapsed one that still bites is the
 * feature failing at the only thing it was for.
 *
 * The scope itself is a word this file never interprets. `tickets` and
 * `comments` are the names of modules, and core knowing them would be core
 * knowing which modules exist; whatever is installed asks about its own word.
 */

/** Everywhere. The one scope core does name, because it is not a module. */
export const SITE_WIDE = "site";

/** A restriction, as much of it as this decision needs. */
export interface Restriction {
    scope: string;
    /** Null for one that never runs out. */
    expiresAt: Date | null;
}

/** Whether this member is kept out of `scope` right now. */
export function restrictedFrom(
    scope: string,
    restrictions: Restriction[],
    now: Date = new Date(),
): boolean {
    const asked = scope.trim().toLowerCase();
    if (asked === "") return false;

    return restrictions.some((restriction) => {
        // Run out is gone. Exactly at the moment it expires, not the day
        // after: an operator setting an hour means an hour.
        if (restriction.expiresAt !== null && restriction.expiresAt.getTime() <= now.getTime()) {
            return false;
        }

        const has = restriction.scope.trim().toLowerCase();
        // The whole site covers every part of it. The reverse never holds:
        // being kept out of one room is not being kept off the site.
        return has === asked || has === SITE_WIDE;
    });
}

/** As long as a scope may be. A word, not a sentence. */
const MAX_SCOPE = 64;

export type NewRestrictionRefusal = "empty_scope" | "already_lapsed" | "too_long";

/**
 * Null when an operator may place this one.
 *
 * Both refusals exist because the alternative is a control that appears to
 * work and does not. A blank scope is read above as "no", so a row holding one
 * is a restriction the screen lists, the operator believes, and nothing
 * enforces. An expiry already in the past is the same thing with a date on it.
 * The comparison matches the one above exactly - at the moment it expires, not
 * the day after - so the two cannot drift into disagreeing about a restriction
 * that is placed and immediately gone.
 */
export function checkNewRestriction(
    scope: string,
    expiresAt: Date | null,
    now: Date = new Date(),
): NewRestrictionRefusal | null {
    const asked = scope.trim();
    if (asked === "") return "empty_scope";
    if (asked.length > MAX_SCOPE) return "too_long";
    if (expiresAt !== null && expiresAt.getTime() <= now.getTime()) return "already_lapsed";
    return null;
}

/**
 * Taking one off, as a change to the row rather than the loss of it.
 *
 * `restrictions-server.ts` keeps lapsed rows on purpose: an operator reading
 * somebody's history wants to see the month they spent out of the tickets.
 * Lifting therefore ends a restriction where it stands and leaves the record
 * of what was done and when.
 */
export function lift(now: Date = new Date()): { expiresAt: Date } {
    return { expiresAt: now };
}
