/**
 * What is actually handed over when a listing sells, and who decides.
 *
 * This module knows how to move credits and take a cut. It does not know what
 * a member is selling: a game item, a rank, a key, something a module invented
 * last week. Whatever is installed says what it can deliver and does the
 * delivering; a listing names one of those kinds.
 *
 * The check happens before the credits move. A kind nobody can deliver has to
 * stop the sale rather than follow it, because the alternative is a buyer who
 * has paid, a seller who has been paid, and nothing handed over - which
 * somebody then unpicks by hand.
 *
 * And it happens at the moment of sale, not only when the listing was written.
 * A module gets uninstalled and the listings it made deliverable outlive it.
 */

/** One kind of thing something installed here can hand over. */
export interface DeliveryKind {
    kind: string;
    label: string;
}

/** Whether anything installed claims this kind. */
export function deliverableBy(kind: string, installed: DeliveryKind[]): boolean {
    const wanted = kind.trim();
    if (wanted === "") return false;
    return installed.some((entry) => entry.kind === wanted);
}

/** The refusal to give before any credits move, or null to go ahead. */
export function deliveryRefusal(
    kind: string,
    installed: DeliveryKind[],
): { refuse: "cannot-deliver" } | null {
    return deliverableBy(kind, installed) ? null : { refuse: "cannot-deliver" };
}
