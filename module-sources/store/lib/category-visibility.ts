/**
 * A category kept back for the people who bought something.
 *
 * The way a shop puts a members' shelf on a public site. This is the one gate
 * in the store that really hides: a product's prerequisite is told to the
 * shopper on purpose, because being told is how they learn the tier below is
 * worth buying, but a category kept back is kept back.
 *
 * Hiding a parent hides its children. Without that the shelf is closed and
 * everything on it is still listed one level down, which is the whole feature
 * failing quietly rather than loudly.
 */

/** A category, as far as this decision is concerned. */
export interface GatedCategory {
    id: string;
    parentId: string | null;
    /** Own any one of these to see it. Empty is visible to everybody. */
    visibleAfterProductIds: string[];
}

/** Whether any category's visibility depends on who is asking. */
export function anyCategoryGated(categories: GatedCategory[]): boolean {
    return categories.some((category) => category.visibleAfterProductIds.length > 0);
}

/**
 * The categories this reader may see, parents before children.
 *
 * A category whose parent is not in the list is kept: nothing hid it, and
 * dropping it would lose a shelf nobody gated - a subcategory of a category
 * an operator deleted, most often.
 */
export function visibleCategories<T extends GatedCategory>(
    categories: T[],
    ownedProductIds: Set<string>,
): T[] {
    const openToReader = (category: GatedCategory) =>
        category.visibleAfterProductIds.length === 0
        || category.visibleAfterProductIds.some((id) => ownedProductIds.has(id));

    const byId = new Map(categories.map((category) => [category.id, category]));

    const shown = (category: GatedCategory, seen: Set<string>): boolean => {
        if (!openToReader(category)) return false;
        if (category.parentId === null) return true;
        const parent = byId.get(category.parentId);
        // A parent nobody can find is a parent that hid nothing.
        if (!parent) return true;
        // A cycle is not something an operator can make through the form, but
        // a bad import could, and a stack overflow is a worse answer than a
        // visible category.
        if (seen.has(parent.id)) return true;
        seen.add(parent.id);
        return shown(parent, seen);
    };

    return categories.filter((category) => shown(category, new Set([category.id])));
}

/** Every product id that opens some category, for one ownership read. */
export function gateProductIds(categories: GatedCategory[]): string[] {
    return [...new Set(categories.flatMap((category) => category.visibleAfterProductIds))];
}
