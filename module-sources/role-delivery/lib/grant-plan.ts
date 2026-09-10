/**
 * Handing a rank over when a listing sells, and the three ways that goes wrong.
 *
 * The market moves credits and takes a cut and does not know what is being
 * sold; whatever is installed says what it can deliver. A rank is not a file:
 * handing one over changes what the buyer holds, and putting it back thirty
 * days later means having remembered what they held before.
 *
 * A role deleted since the listing was written. The market asks again at the
 * moment of sale for exactly this reason, and answering "handled" for a role
 * that is not there is a sale nobody unpicks until the buyer complains.
 *
 * A buyer who already holds the rank for good, because an operator gave it to
 * them. Selling thirty days of it has two endings and both are wrong: they
 * keep it for ever, or the sweep takes away a promotion the operator made. So
 * it is refused before any credits move, which is the one moment a refusal
 * costs nothing.
 *
 * And what to put back. Recording the granted role as the previous one is the
 * shape that makes a rank permanent by accident: `roleAfterLapse` sees the
 * member already holds what it was about to restore and writes nothing, for
 * ever.
 *
 * Which is why the answer names which of the two writes it is rather than
 * handing back one shape with a nullable field. Extending must not touch what
 * the row already remembers, and `previousRoleId: null` would have meant both
 * "put back the site default" and "leave it alone" - a difference a caller
 * would get right for as long as somebody kept reading this comment.
 */

export interface WantedRole {
    roleId: string;
    days: number;
}

/** The buyer, as far as this decision is concerned. */
export interface Buyer {
    roleId: string | null;
}

/** The grant already on the row, when there is one. */
export interface StandingGrant {
    expiresAt: Date;
}

/** The site's own answer: which roles exist right now. */
export interface RoleWorld {
    existingRoleIds: ReadonlySet<string>;
}

export type GrantPlan =
    /** No grant yet: write one, remembering what the buyer holds now. */
    | { create: { roleId: string; previousRoleId: string | null; expiresAt: Date } }
    /** One already: push the date out and leave its memory alone. */
    | { extend: { roleId: string; expiresAt: Date } }
    | { refuse: "unknown_role" | "bad_duration" | "already_held" };

/** As long as a listing may sell a rank for. Ten years is nobody's intent. */
const MAX_DAYS = 3650;

export function planGrant(
    wanted: WantedRole,
    buyer: Buyer,
    standing: StandingGrant | null,
    world: RoleWorld,
    now: Date,
): GrantPlan {
    const roleId = wanted.roleId.trim();
    if (roleId === "" || !world.existingRoleIds.has(roleId)) return { refuse: "unknown_role" };

    if (!Number.isFinite(wanted.days) || wanted.days < 1 || wanted.days > MAX_DAYS) {
        return { refuse: "bad_duration" };
    }
    const days = Math.floor(wanted.days);

    // Held for good: nothing is going to take it away, so time cannot be sold
    // against it without one of the two wrong endings.
    if (buyer.roleId === roleId && standing === null) return { refuse: "already_held" };

    // From whichever is later. Twenty-five days left plus thirty bought is
    // fifty-five; starting again is taking money for days it then deletes.
    const from = standing && standing.expiresAt > now ? standing.expiresAt : now;
    const expiresAt = new Date(from.getTime() + days * 86_400_000);

    if (standing) return { extend: { roleId, expiresAt } };

    // Whatever they hold now, which is never the granted role: that case is
    // refused above.
    return { create: { roleId, previousRoleId: buyer.roleId, expiresAt } };
}
