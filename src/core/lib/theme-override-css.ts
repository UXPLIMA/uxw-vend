/**
 * The `<style>` block an operator's saved colours become.
 *
 * The layout renders this string with `dangerouslySetInnerHTML`, so what is
 * built here is HTML, not just CSS. Values were already checked hard: a hex
 * pattern, on the way in and again on the way out. Names were not checked at
 * all, and a name is interpolated straight into a declaration. One containing
 * `</style><script>` closes the element and opens another, on every page, for
 * every visitor.
 *
 * So the name is checked here as well, and the check is an allowlist rather
 * than an escape: a design token is letters, digits and dashes, and there is
 * no colour anyone wanted whose name contains a bracket. Building the string
 * in one place, rather than in the layout, is what lets a test say so.
 */

/** A design token's name: what a theme manifest is allowed to call one. */
const TOKEN_NAME = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/** `#rgb`, `#rrggbb` or `#rrggbbaa`, and nothing else. */
const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** True when `name` is a token name and nothing more. */
export function isTokenName(name: string): boolean {
    return TOKEN_NAME.test(name);
}

/**
 * The override block for one theme and mode, or an empty string when nothing
 * survives the checks. Same specificity as the generated token stylesheet, so
 * the later declaration wins the cascade.
 */
export function buildTokenOverrideCss(
    themeId: string,
    mode: string,
    colors: Record<string, unknown>,
): string {
    if (!isTokenName(themeId) || !isTokenName(mode)) return "";

    const declarations = Object.entries(colors)
        .filter(([name, value]) => isTokenName(name) && typeof value === "string" && HEX_COLOUR.test(value))
        .map(([name, value]) => `  --uxw-color-${name}: ${value as string};`);

    if (declarations.length === 0) return "";

    return `[data-theme="${themeId}"][data-mode="${mode}"] {\n${declarations.join("\n")}\n}`;
}
