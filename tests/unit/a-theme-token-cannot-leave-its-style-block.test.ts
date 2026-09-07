import { describe, it, expect } from "vitest";
import { buildTokenOverrideCss } from "@/core/lib/theme-override-css";

/**
 * A colour an operator picked cannot become a script tag.
 *
 * The layout renders an operator's colour overrides as a `<style>` block
 * through `dangerouslySetInnerHTML`, so whatever ends up in that string is
 * HTML. The values were checked hard: a strict hex pattern, twice, once on
 * the way in and once on the way out. The names were not checked at all. The
 * only guard on a token name refused `__proto__`, `constructor` and
 * `prototype`, which is about prototype pollution and says nothing about CSS.
 *
 * A name is interpolated straight into `--uxw-color-<name>: <value>;`. One
 * containing `</style><script>` closes the element and opens another, and the
 * result is stored, served to every visitor of the site, and written by
 * whoever can save a theme customization rather than by whoever is reading.
 *
 * A token name is a token name: letters, digits and dashes. Anything else is
 * dropped rather than escaped, because there is no colour anyone wanted whose
 * name contains a bracket.
 */
describe("the style block an operator's colours become", () => {
    const css = (colors: Record<string, string>) => buildTokenOverrideCss("flat", "light", colors);

    it("declares a colour under its own name", () => {
        expect(css({ primary: "#2563eb" })).toContain("--uxw-color-primary: #2563eb;");
    });

    it("scopes the declarations to the theme and mode that asked for them", () => {
        expect(css({ primary: "#2563eb" })).toContain('[data-theme="flat"][data-mode="light"]');
    });

    it("drops a name that would close the rule it sits in", () => {
        expect(css({ "a}": "#ffffff" })).toBe("");
    });

    it("drops a name that would close the style element", () => {
        const out = css({ "a</style><script>alert(1)</script><style>x": "#ffffff" });
        expect(out).not.toContain("<script>");
        expect(out).not.toContain("</style>");
        expect(out).toBe("");
    });

    it("drops a name carrying a quote, a semicolon or a space", () => {
        expect(css({ 'a"b': "#fff" })).toBe("");
        expect(css({ "a;b": "#fff" })).toBe("");
        expect(css({ "a b": "#fff" })).toBe("");
    });

    it("keeps the good names when a bad one travels with them", () => {
        const out = css({ primary: "#111111", "evil</style>": "#222222" });
        expect(out).toContain("--uxw-color-primary: #111111;");
        expect(out).not.toContain("evil");
    });

    it("still refuses a value that is not a colour", () => {
        expect(css({ primary: "red; background: url(x)" })).toBe("");
    });

    it("says nothing when there is nothing to say", () => {
        expect(css({})).toBe("");
    });
});
