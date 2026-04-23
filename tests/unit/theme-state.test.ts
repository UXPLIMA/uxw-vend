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

    it("returns manifest + mode + empty settings when no overrides", async () => {
        const { prisma } = await import("@/core/lib/db");
        (prisma.themeState.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "flat", mode: "light" });
        (prisma.themeCustomization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const { getActiveTheme } = await import("@/core/lib/theme-state");
        const result = await getActiveTheme();
        expect(result.themeId).toBe("flat");
        expect(result.mode).toBe("light");
        expect(result.settings).toEqual({});
    });

    it("groups settings rows by groupKey", async () => {
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
        expect(result.settings.hero).toEqual({ title: "Hi", cta: "Go" });
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
