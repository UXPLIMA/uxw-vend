import { describe, it, expect } from "vitest";
import { resolveMode } from "@/core/lib/theme-mode";

const twoModes = { default: "light", available: { light: {}, dark: {} } } as const;
const oneMode  = { default: "dark",  available: { dark: {} } } as const;

describe("resolveMode", () => {
    it("returns the only mode when theme ships one", () => {
        expect(resolveMode({ manifest: { modes: oneMode }, forced: "light", cookie: "light", systemPrefersDark: true })).toBe("dark");
    });
    it("respects admin-forced mode when valid", () => {
        expect(resolveMode({ manifest: { modes: twoModes }, forced: "dark", cookie: "light", systemPrefersDark: false })).toBe("dark");
    });
    it("ignores admin-forced when not in available modes", () => {
        expect(resolveMode({ manifest: { modes: twoModes }, forced: "purple", cookie: "dark", systemPrefersDark: false })).toBe("dark");
    });
    it("falls back to cookie", () => {
        expect(resolveMode({ manifest: { modes: twoModes }, cookie: "dark" })).toBe("dark");
    });
    it("falls back to prefers-color-scheme", () => {
        expect(resolveMode({ manifest: { modes: twoModes }, systemPrefersDark: true })).toBe("dark");
    });
    it("falls back to manifest default", () => {
        expect(resolveMode({ manifest: { modes: twoModes } })).toBe("light");
    });
});
