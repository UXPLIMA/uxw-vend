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
