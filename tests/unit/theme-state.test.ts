import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/core/lib/db", () => ({
    prisma: {
        themeState:          { findFirst: vi.fn() },
        themeCustomization:  { findUnique: vi.fn() },
        themeSetting:        { findMany: vi.fn() },
    },
}));

describe("getActiveTheme", () => {
    beforeEach(() => vi.clearAllMocks());

    it("merges manifest field defaults when no saved settings exist", async () => {
        const { prisma } = await import("@/core/lib/db");
        (prisma.themeState.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "flat", mode: "light" });
        (prisma.themeCustomization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const { getActiveTheme } = await import("@/core/lib/theme-state");
        const result = await getActiveTheme();
        expect(result.themeId).toBe("flat");
        expect(result.mode).toBe("light");
        // Flat declares a hero group with field-level `default` values; they
        // surface even when no admin override row exists. Groups with no
        // declared defaults remain absent.
        expect(result.settings.hero).toMatchObject({
            enabled: false,
            title: "Welcome",
            ctaText: "Get started",
        });
        expect(result.settings.landing).toBeUndefined();
    });

    it("groups saved rows by groupKey and merges them on top of manifest defaults", async () => {
        const { prisma } = await import("@/core/lib/db");
        (prisma.themeState.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "flat", mode: "dark" });
        (prisma.themeCustomization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            { groupKey: "hero",    key: "title", value: "Hi" },
            { groupKey: "hero",    key: "cta",   value: "Go" },
            { groupKey: "landing", key: "intro", value: "Welcome" },
        ]);

        const { getActiveTheme } = await import("@/core/lib/theme-state");
        const result = await getActiveTheme();
        // Saved values override the manifest defaults; arbitrary admin-saved
        // keys (cta) sit alongside the schema-declared ones.
        expect(result.settings.hero).toMatchObject({ title: "Hi", cta: "Go" });
        // Groups the active theme doesn't declare pass through as-is.
        expect(result.settings.landing).toEqual({ intro: "Welcome" });
    });

    it("falls back to default theme when ThemeState row missing", async () => {
        const { prisma } = await import("@/core/lib/db");
        (prisma.themeState.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeCustomization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const { getActiveTheme } = await import("@/core/lib/theme-state");
        const result = await getActiveTheme();
        expect(result.themeId).toBe("flat"); // defaultThemeId from generated registry
    });
});
