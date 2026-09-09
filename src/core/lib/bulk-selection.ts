/**
 * Which rows a bulk action will touch, and the number the button may say.
 *
 * A list screen ticks row ids into a set and puts its size on a destructive
 * button. The set used to outlive the listing - the page, the search, the
 * refetch after a create - so an operator could tick five rows, page on, tick
 * three more, and be offered "Delete 8" while looking at three of them. An id
 * left behind by a row deleted elsewhere counted the same.
 *
 * `narrowTo` is the answer: the selection is cut down to the rows currently
 * listed whenever the listing changes, so the count on the button is always
 * the count of rows on screen. Selecting across pages is what that gives up,
 * and it is worth giving up - a destructive button that names rows the
 * operator cannot see is the more expensive of the two.
 *
 * Every function returns a new set rather than editing one, except where
 * nothing changed: `narrowTo` hands back the set it was given so a caller
 * holding it in state does not re-render on every listing.
 */

export type Selection = ReadonlySet<string>;

/** What the header checkbox shows for the rows currently listed. */
export type HeaderState = "none" | "some" | "all";

export function togglePick(selection: Selection, id: string): Set<string> {
    const next = new Set(selection);
    if (!next.delete(id)) next.add(id);
    return next;
}

export function pickAll(selection: Selection, listed: readonly string[]): Set<string> {
    const next = new Set(selection);
    for (const id of listed) next.add(id);
    return next;
}

export function pickNone(): Set<string> {
    return new Set();
}

export function headerState(selection: Selection, listed: readonly string[]): HeaderState {
    // `every` over an empty list is true, which would tick the header of a
    // list with no rows and offer an action over none of them.
    if (listed.length === 0) return "none";
    let picked = 0;
    for (const id of listed) if (selection.has(id)) picked++;
    if (picked === 0) return "none";
    return picked === listed.length ? "all" : "some";
}

export function narrowTo(selection: Selection, listed: readonly string[]): Selection {
    if (selection.size === 0) return selection;
    const present = new Set(listed);
    const kept = [...selection].filter((id) => present.has(id));
    if (kept.length === selection.size) return selection;
    return new Set(kept);
}
