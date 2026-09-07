/**
 * Which products a page of a popularity ranking needs.
 *
 * The ranking is two lists laid end to end: the products that have sold,
 * most first, and then everything else. Only the first list can be ordered by
 * sales, so a page can fall in either, or across the join between them, and
 * this works out which.
 *
 * It is separate from the route because getting it wrong is invisible - a page
 * that quietly repeats a product or drops one reads as a shop with an odd
 * catalogue rather than as a bug - and because it is the only part of the
 * change that can be tested exhaustively.
 */
export interface PopularWindow {
    /** Ranked ids inside this page, in ranking order. */
    ids: string[];
    /** How far into the products that have never sold this page reaches. */
    tailSkip: number;
    /** How many of those it needs. */
    tailTake: number;
}

export function popularWindow(rankedIds: string[], skip: number, take: number): PopularWindow {
    const ids = rankedIds.slice(skip, skip + take);
    const tailSkip = Math.max(0, skip - rankedIds.length);
    const tailTake = Math.max(0, take - ids.length);
    return { ids, tailSkip, tailTake };
}
