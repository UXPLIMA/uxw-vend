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

/**
 * Resolves any accepted spelling of an icon name to the id lucide actually
 * answers to, or null if there is no such icon.
 *
 * `toIconSlug` alone is not enough, because it splits on case and lucide
 * splits on digits too: seven module manifests name `Gamepad2`, `Code2`,
 * `Link2` or `Building2`, all of which slug to `gamepad2` and friends while
 * lucide calls them `gamepad-2`. `DynamicIcon` answered each one with a
 * console warning and rendered the fallback, so a payment gateway's row in
 * the marketplace had no icon and the panel's console had a warning per
 * module.
 *
 * The naive fix - always hyphenate before a digit - breaks the other
 * direction: `Grid2x2` would become `grid-2x-2`, and lucide calls that
 * `grid-2x2`. So instead of guessing where the hyphens go, compare with the
 * hyphens taken out. Eighteen lucide names collide that way and all eighteen
 * are alias pairs for the same glyph (`axis-3d` / `axis-3-d`), so whichever
 * wins draws the same picture.
 *
 * The exact slug is still tried first, so a name that already matches keeps
 * matching and nothing here can redirect it.
 */
export function resolveIconName(name: string, known: readonly string[]): string | null {
    const slug = toIconSlug(name);
    if (slug === "") return null;
    if (known.includes(slug)) return slug;
    const squashed = slug.replace(/-/g, "");
    return known.find((candidate) => candidate.replace(/-/g, "") === squashed) ?? null;
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
