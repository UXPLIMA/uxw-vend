import { describe, it, expect } from "vitest";
import { computeOverrideDiff, applyOverrides } from "@/core/components/admin/theme-customizer/diff";

const defaults = { hero: { headline: "Hi", enabled: true }, footer: { text: "©" } };

describe("computeOverrideDiff", () => {
    it("returns an empty object when nothing differs", () => {
        expect(computeOverrideDiff(defaults, defaults)).toEqual({});
    });

    it("keeps only the fields that differ from defaults", () => {
        const current = { hero: { headline: "Hello", enabled: true }, footer: { text: "©" } };
        expect(computeOverrideDiff(defaults, current)).toEqual({ hero: { headline: "Hello" } });
    });

    it("drops fields that equal defaults even if nested siblings changed", () => {
        const current = { hero: { headline: "A", enabled: true } };
        expect(computeOverrideDiff(defaults, current)).toEqual({ hero: { headline: "A" } });
    });
});

describe("applyOverrides", () => {
    it("deep-merges overrides onto defaults", () => {
        const overrides = { hero: { headline: "Override" } };
        const result = applyOverrides(defaults, overrides);
        expect(result.hero).toEqual({ headline: "Override", enabled: true });
    });
});
