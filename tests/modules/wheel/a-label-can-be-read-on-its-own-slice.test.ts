/**
 * A prize name is readable on the colour an operator chose for it.
 *
 * Every label on the wheel was white, because most of the palette the prize
 * form offers is dark enough for that. Most is not all: white on the amber
 * in that palette (#eab308) measures about 1.9:1, and on the lighter greens
 * and yellows an operator can type it is worse. The name of the prize is the
 * one thing the wheel exists to say, so it cannot be left to whether the
 * operator happened to pick a dark colour.
 *
 * White stays the ink wherever it can be read, because black and white labels
 * mixed across one wheel reads as an accident. It gives way only where white
 * falls below 3:1, which on the palette the prize form offers is the yellow,
 * the amber and the mid green. Picking the better of two inks is not the same
 * as passing AA - a mid grey fails against both - but it is the best either
 * choice can do, and the colour is the operator's.
 */
import { describe, it, expect } from "vitest";
import { inkFor } from "@/modules/wheel/lib/wheels";

/** Contrast ratio, straight from the WCAG definition, for checking the call. */
function contrast(hex: string, ink: "light" | "dark"): number {
    const channel = (at: number) => {
        const value = parseInt(hex.replace("#", "").slice(at, at + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
    const other = ink === "light" ? 1 : 0;
    const [lighter, darker] = luminance > other ? [luminance, other] : [other, luminance];
    return (lighter + 0.05) / (darker + 0.05);
}

describe("the ink a prize name is written in", () => {
    it("turns dark only where white cannot be read", () => {
        // Below 3:1 in white: the two the old wheel was unreadable on.
        expect(inkFor("#eab308")).toBe("dark");
        expect(inkFor("#22c55e")).toBe("dark");
        // Above it: white, the way the rest of the wheel is written.
        expect(inkFor("#3b82f6")).toBe("light");
        expect(inkFor("#1f2937")).toBe("light");
    });

    it("beats the white it replaced, on every colour the form offers", () => {
        // The palette the prize screen presents, and the one the old wheel
        // wrote white on regardless.
        const palette = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#64748b", "#eab308"];
        for (const colour of palette) {
            expect(contrast(colour, inkFor(colour))).toBeGreaterThanOrEqual(contrast(colour, "light"));
        }
        // And on the one that was actually unreadable, it is a real jump.
        expect(contrast("#eab308", inkFor("#eab308"))).toBeGreaterThan(4.5);
    });

    it("answers for a short hex, and for nonsense", () => {
        expect(inkFor("#fff")).toBe("dark");
        expect(inkFor("#000")).toBe("light");
        // An operator can type anything into the colour field. White ink is
        // what the wheel had before, so it is the answer that changes least.
        expect(inkFor("rebeccapurple")).toBe("light");
        expect(inkFor("")).toBe("light");
    });
});
