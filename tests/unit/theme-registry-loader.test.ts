import { describe, it, expect } from "vitest";
import { resolveMergedTheme } from "@/core/lib/theme-registry-loader";

const flat = {
    schemaVersion: 1 as const, id: "flat", name: "Flat", description: "", version: "1.0.0",
    type: "light" as const, tokens: { colors: { primary: { type: "color" as const, default: "#ffffff" } } },
    config: {},
};

const dark = {
    schemaVersion: 1 as const, id: "flat-dark", name: "Dark", description: "", version: "1.0.0",
    type: "dark" as const, parent: "flat", tokens: { colors: { primary: { type: "color" as const, default: "#000000" } } },
    config: {},
};

describe("resolveMergedTheme", () => {
    it("returns the manifest unchanged when no parent", () => {
        const resolved = resolveMergedTheme(flat, { flat });
        expect(resolved.tokens.colors?.primary.default).toBe("#ffffff");
    });

    it("overlays child tokens onto parent", () => {
        const resolved = resolveMergedTheme(dark, { flat, "flat-dark": dark });
        expect(resolved.tokens.colors?.primary.default).toBe("#000000");
    });

    it("inherits parent tokens child doesn't override", () => {
        const parent = { ...flat, tokens: { colors: {
            primary:   { type: "color" as const, default: "#aaa" },
            secondary: { type: "color" as const, default: "#bbb" },
        } } };
        const child = { ...dark, tokens: { colors: {
            primary: { type: "color" as const, default: "#000" },
        } } };
        const resolved = resolveMergedTheme(child, { flat: parent, "flat-dark": child });
        expect(resolved.tokens.colors?.primary.default).toBe("#000");
        expect(resolved.tokens.colors?.secondary.default).toBe("#bbb");
    });

    it("throws on cyclic parent reference", () => {
        const a = { ...flat, id: "a", parent: "b" };
        const b = { ...flat, id: "b", parent: "a" };
        expect(() => resolveMergedTheme(a, { a, b })).toThrow(/cycle/i);
    });
});
