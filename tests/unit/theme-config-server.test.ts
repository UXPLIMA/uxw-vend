import { describe, it, expect, vi } from "vitest";

const mockSetting = { value: { active_theme: "flat" } };
const mockCustomization = { overrides: { hero: { headline: "custom" } } };

vi.mock("@/core/lib/db", () => ({
    prisma: {
        setting: { findUnique: vi.fn(async () => mockSetting) },
        themeCustomization: { findUnique: vi.fn(async () => mockCustomization) },
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

describe("getThemeConfig (server)", () => {
    it("merges overrides on top of defaults", async () => {
        const { getThemeConfig } = await import("@/core/lib/theme-config");
        const { config } = await getThemeConfig();
        expect((config as { hero?: { headline?: string; enabled?: boolean } }).hero?.headline).toBe("custom");
        expect((config as { hero?: { headline?: string; enabled?: boolean } }).hero?.enabled).toBe(true);
    });
});
