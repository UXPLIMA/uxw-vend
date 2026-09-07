import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { radiusLength } from "@/core/lib/theme-radius";

/**
 * A theme's radius has to reach CSS as a length.
 *
 * The manifest offers the operator a choice by name - "Square (0)", "Rounded
 * (0.5rem)" - and stores what they picked as `md`. The generator wrote that
 * word straight into the variable: `--uxw-radius: md`. Nothing complains,
 * because a custom property holds any text at all; the failure arrives at the
 * places that do arithmetic with it. `min(md, 0.375rem)` is not a value, so
 * the whole declaration is dropped and the element falls back to a square
 * corner.
 *
 * Measured against a production build on 2026-09-07: the login page's checkbox
 * computed `border-radius: 0px` while its class said `min(var(--uxw-radius),
 * .375rem)`, and `--uxw-radius` read `md`. Every control that clamps the theme
 * radius the same way was square for the same reason, on every install running
 * the flat theme, which is the one that ships.
 *
 * So the keyword is mapped where it is written, and this file holds both
 * halves: the mapping, and a check that nothing in the generated stylesheet
 * ever declares a radius CSS cannot compute with.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("the radius a theme asks for", () => {
    it("turns each choice the manifest offers into the length its label promises", () => {
        // The labels in src/themes/flat/theme.json name these exactly.
        expect(radiusLength("none")).toBe("0px");
        expect(radiusLength("sm")).toBe("0.25rem");
        expect(radiusLength("md")).toBe("0.5rem");
        expect(radiusLength("lg")).toBe("0.75rem");
    });

    it("passes a length through, because a slider token is already one", () => {
        expect(radiusLength("0.375rem")).toBe("0.375rem");
        expect(radiusLength("4px")).toBe("4px");
        expect(radiusLength("0")).toBe("0");
    });

    it("reads a bare number as pixels, which is what a slider gives", () => {
        expect(radiusLength(8)).toBe("8px");
        expect(radiusLength(0)).toBe("0px");
    });

    it("refuses anything it cannot turn into a length", () => {
        // Refusing means the declaration is not written at all, so the
        // stylesheet's own default stands - a wrong radius beats a broken one.
        for (const junk of ["chunky", "", "12", "red", "; color: red", null, undefined, {}]) {
            expect(radiusLength(junk as never), String(junk)).toBeNull();
        }
    });

    it("does not let a value out that would break the declaration around it", () => {
        // Whatever comes back is interpolated into CSS, so it may not carry
        // anything that could close a declaration or open another.
        for (const value of ["none", "md", "0.5rem", 8]) {
            const out = radiusLength(value as never);
            expect(out).not.toMatch(/[;{}()]/);
        }
    });
});

describe("the generated theme stylesheet", () => {
    const css = fs.readFileSync(path.join(ROOT, "src/core/generated/theme-tokens.css"), "utf8");

    it("declares a radius CSS can compute with, in every theme it carries", () => {
        const declared = [...css.matchAll(/--uxw-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
        expect(declared.length).toBeGreaterThan(0);
        for (const value of declared) {
            expect(value, `--uxw-radius: ${value} is not a length`).toMatch(/^(0|[\d.]+(px|rem|em|%)|9999px)$/);
        }
    });

    it("is consumed by a clamp, which is what makes an unusable value visible", () => {
        // If this ever stops being arithmetic, the test above stops mattering:
        // a keyword would sit in the variable harmlessly and the next thing to
        // do maths with it would break instead.
        const globals = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
        expect(globals).toMatch(/\.uxw-checkbox-radius\s*\{[^}]*min\(var\(--uxw-radius\)/);
    });
});
