import { describe, it, expect } from "vitest";
import { themeManifestSchema } from "@/core/lib/theme-manifest-schema";

const minimal = {
    schemaVersion: 1,
    id: "my-theme",
    name: "My Theme",
    description: "Test theme",
    version: "1.0.0",
    type: "light",
    tokens: {},
    config: {},
};

describe("themeManifestSchema", () => {
    it("accepts a minimal valid manifest", () => {
        expect(themeManifestSchema.safeParse(minimal).success).toBe(true);
    });

    it("rejects bad id format", () => {
        expect(themeManifestSchema.safeParse({ ...minimal, id: "Bad_Id" }).success).toBe(false);
    });

    it("rejects non-semver version", () => {
        expect(themeManifestSchema.safeParse({ ...minimal, version: "not-semver" }).success).toBe(false);
    });

    it("rejects non-hex color tokens", () => {
        const bad = {
            ...minimal,
            tokens: { colors: { primary: { type: "color", default: "not-a-color" } } },
        };
        expect(themeManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("accepts all supported field types", () => {
        const full = {
            ...minimal,
            config: {
                hero: {
                    label: "Hero",
                    fields: {
                        enabled: { type: "toggle", default: true },
                        logoImage: { type: "image" },
                        headline: { type: "text", max: 100 },
                        ctaHref: { type: "url" },
                        blurb: { type: "richtext", max: 500 },
                        count: { type: "slider", min: 1, max: 10 },
                        layout: { type: "select", options: [{ value: "a", label: "A" }] },
                        accent: { type: "color", default: "#ff00aa" },
                    },
                },
            },
        };
        expect(themeManifestSchema.safeParse(full).success).toBe(true);
    });

    it("rejects an unknown field type", () => {
        const bad = {
            ...minimal,
            config: { g: { label: "G", fields: { x: { type: "laser" } } } },
        };
        expect(themeManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("rejects text fields with max > 10000", () => {
        const bad = {
            ...minimal,
            config: { g: { label: "G", fields: { x: { type: "text", max: 999999 } } } },
        };
        expect(themeManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("accepts optional parent theme id", () => {
        expect(themeManifestSchema.safeParse({ ...minimal, parent: "flat" }).success).toBe(true);
    });

    it("rejects 5-digit and 7-digit hex colors", () => {
        const bad5 = { ...minimal, tokens: { colors: { p: { type: "color", default: "#abc12" } } } };
        const bad7 = { ...minimal, tokens: { colors: { p: { type: "color", default: "#abcde12" } } } };
        expect(themeManifestSchema.safeParse(bad5).success).toBe(false);
        expect(themeManifestSchema.safeParse(bad7).success).toBe(false);
    });

    it("accepts 3, 6, and 8 digit hex colors", () => {
        for (const c of ["#abc", "#aabbcc", "#aabbccdd"]) {
            const ok = { ...minimal, tokens: { colors: { p: { type: "color", default: c } } } };
            expect(themeManifestSchema.safeParse(ok).success).toBe(true);
        }
    });

    it("rejects version strings with trailing garbage", () => {
        expect(themeManifestSchema.safeParse({ ...minimal, version: "1.0.0anything" }).success).toBe(false);
        expect(themeManifestSchema.safeParse({ ...minimal, version: "1.0.0-beta.1" }).success).toBe(true);
    });

    it("rejects overlong translation string values", () => {
        const longValue = "x".repeat(2001);
        const bad = {
            ...minimal,
            translations: { en: { ns: { key: longValue } } },
        };
        expect(themeManifestSchema.safeParse(bad).success).toBe(false);
    });
});
