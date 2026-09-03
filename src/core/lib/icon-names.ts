/**
 * Lucide icon-name helpers, shared by `NavIcon` (which resolves a name to a
 * component) and the icon picker (which lets an admin choose one).
 *
 * A name reaches the platform from three directions - a module manifest, the
 * navbar editor, a page block - and any of them may spell it PascalCase
 * ("ShoppingBag") or kebab-case ("shopping-bag"). Lucide's dynamic loader only
 * answers to kebab-case, so every lookup goes through `toIconSlug` first.
 */

/** Normalises any accepted spelling of an icon name to lucide's kebab-case id. */
export function toIconSlug(name: string): string {
    return name
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
}

/** Human-readable label for a picker tile: "shopping-bag" becomes "Shopping Bag". */
export function iconLabel(name: string): string {
    return toIconSlug(name)
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Ranks icon names against a search query, best match first.
 *
 * The ranking is deliberately simple - exact, then prefix, then word-start,
 * then anywhere - because the alternative (fuzzy matching) puts "bar-chart"
 * ahead of "bar" for the query "bar", which reads as a bug to whoever is
 * looking for the icon they already know the name of. Ties keep lucide's own
 * alphabetical order.
 *
 * An empty query returns every name, unchanged: the picker opens on the full
 * list rather than on nothing.
 */
export function searchIconNames(names: readonly string[], query: string): string[] {
    const needle = toIconSlug(query);
    if (needle === "") return [...names];

    const ranked: { name: string; score: number; index: number }[] = [];
    names.forEach((name, index) => {
        const score = scoreIconName(name, needle);
        if (score !== null) ranked.push({ name, score, index });
    });

    ranked.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.index - b.index));
    return ranked.map((entry) => entry.name);
}

function scoreIconName(name: string, needle: string): number | null {
    if (name === needle) return 0;
    if (name.startsWith(needle)) return 1;
    // A word start: "chart" should find "bar-chart" before "linechart"-style
    // names where the match falls mid-word.
    if (name.includes(`-${needle}`)) return 2;
    if (name.includes(needle)) return 3;
    return null;
}
