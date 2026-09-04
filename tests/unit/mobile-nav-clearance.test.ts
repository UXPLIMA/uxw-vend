import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CSS = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const NAV = fs.readFileSync(path.join(ROOT, "src/core/components/layout/MobileBottomNav.tsx"), "utf8");

/**
 * The mobile bottom navigation is `fixed bottom-0` and `sm:hidden`, so below
 * the sm breakpoint it covers the last 3.5rem of every page: a footer, the
 * last row of a list, the submit button under a form. Nothing compensated for
 * it, and the `safe-area-bottom` class the nav carried had never been defined
 * anywhere, so on a device with a home indicator the bar sat under it too.
 */
describe("the mobile bottom navigation", () => {
    it("is fixed and only shown below the sm breakpoint", () => {
        expect(NAV).toContain("fixed bottom-0");
        expect(NAV).toContain("sm:hidden");
    });

    it("every class it names is defined somewhere", () => {
        const classes = /className="([^"]*)"/.exec(NAV.slice(NAV.indexOf("<nav")))?.[1] ?? "";
        for (const name of classes.split(/\s+/)) {
            // Tailwind utilities and its variants are not ours to define; a
            // bare hyphenated name that Tailwind does not ship is.
            if (!/^safe-area/.test(name)) continue;
            expect(CSS, `.${name} is used by the nav but defined nowhere`).toContain(`.${name}`);
        }
    });

    it("the page leaves room for it below that breakpoint", () => {
        expect(CSS).toMatch(/@media\s*\(max-width:\s*639/);
        expect(CSS).toContain("--uxw-mobile-nav-height");
        expect(CSS).toMatch(/padding-bottom:\s*calc\(var\(--uxw-mobile-nav-height\)/);
    });

    it("and clears the home indicator on top of that", () => {
        expect(CSS).toContain("env(safe-area-inset-bottom");
    });
});
