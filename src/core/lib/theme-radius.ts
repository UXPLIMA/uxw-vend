/**
 * The radius a theme asks for, as a length CSS can compute with.
 *
 * A theme manifest offers the operator a named choice - "Square (0)",
 * "Rounded (0.5rem)" - and stores the name: `md`. That name went straight into
 * the variable, and a custom property accepts any text at all, so nothing
 * complained. The failure landed on whatever did arithmetic with it:
 * `min(md, 0.375rem)` is not a value, the declaration is dropped, and the
 * control falls back to a square corner. Measured on a production build: the
 * checkbox computed `border-radius: 0px` on the theme that ships.
 *
 * A slider token gives a number or a length instead, so both are accepted.
 * Anything else returns null, and the caller writes no declaration at all -
 * the stylesheet's own default is a better answer than a broken rule.
 */

/** The names a manifest may offer, and the length each label promises. */
const KEYWORDS: Record<string, string> = {
    none: "0px",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
};

/** A CSS length this is willing to pass through untouched. */
const LENGTH = /^(0|[0-9]*\.?[0-9]+(px|rem|em|%))$/;

export function radiusLength(value: unknown): string | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? `${value}px` : null;
    }
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed in KEYWORDS) return KEYWORDS[trimmed];
    return LENGTH.test(trimmed) ? trimmed : null;
}
