import { describe, it, expect, vi } from "vitest";

const mockCustomization = { overrides: { hero: { headline: "custom" } } };

vi.mock("@/core/lib/db", () => ({
    prisma: {
        themeState: { findFirst: vi.fn(async () => ({ themeId: "flat", mode: "light" })) },
        themeCustomization: { findUnique: vi.fn(async () => mockCustomization) },
        themeSetting: { findMany: vi.fn(async () => []) },
    },
}));

vi.mock("@/core/generated/theme-registry", () => ({
    themeRegistry: {
        flat: {
            schemaVersion: 1 as const,
            id: "flat",
            name: "Flat",
            description: "",
            version: "1.0.0",
            type: "light" as const,
            modes: { default: "light", available: { light: {} } },
            tokens: {},
            config: {
                hero: {
                    label: "Hero",
                    fields: {
                        headline: { type: "text", default: "default" },
                        enabled:  { type: "toggle", default: true },
                    },
                },
            },
        },
    },
    themeIds: ["flat"] as const,
    defaultThemeId: "flat",
}));

describe("getActiveTheme (server)", () => {
    it("returns tokenOverrides from customization", async () => {
        const { getActiveTheme } = await import("@/core/lib/theme-state");
        const { tokenOverrides } = await getActiveTheme();
        expect((tokenOverrides as { hero?: { headline?: string } }).hero?.headline).toBe("custom");
    });
});
