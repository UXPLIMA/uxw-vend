import { prisma } from "./db";
import { themeRegistry, defaultThemeId } from "@/core/generated/theme-registry";
import type { ThemeManifest } from "./theme-manifest-schema";

export interface ActiveTheme {
    themeId: string;
    mode: string;
    manifest: ThemeManifest;
    tokenOverrides: Record<string, unknown>;
    settings: Record<string, Record<string, unknown>>;
}

/**
 * Resolve the active theme + mode from DB, merged with any customization
 * overrides and theme-owned settings. Three queries; cacheable upstream.
 */
export async function getActiveTheme(): Promise<ActiveTheme> {
    const state = await prisma.themeState.findFirst().catch(() => null);
    const themeId = state?.themeId && themeRegistry[state.themeId] ? state.themeId : defaultThemeId;
    const manifest = themeRegistry[themeId] ?? themeRegistry[defaultThemeId];
    const mode = state?.mode && manifest.modes.available[state.mode] ? state.mode : manifest.modes.default;

    const [customization, settingRows] = await Promise.all([
        prisma.themeCustomization.findUnique({ where: { themeId_mode: { themeId, mode } } }).catch(() => null),
        prisma.themeSetting.findMany({ where: { themeId } }).catch(() => []),
    ]);

    // Start every declared settings group + field at its manifest-level
    // `default`. DB rows then override — so a theme that ships with field
    // defaults renders them immediately on first install, before the admin
    // has saved anything. Without this step, any component reading
    // useThemeConfig()?.hero?.title on a freshly-switched theme sees
    // undefined and degrades to nothing visible.
    const settings: Record<string, Record<string, unknown>> = {};
    for (const [groupKey, groupDef] of Object.entries(manifest.settings ?? {})) {
        const group: Record<string, unknown> = {};
        for (const [fieldKey, fieldDef] of Object.entries(groupDef.fields)) {
            if ("default" in fieldDef && fieldDef.default !== undefined) {
                group[fieldKey] = fieldDef.default;
            }
        }
        if (Object.keys(group).length > 0) settings[groupKey] = group;
    }
    for (const row of settingRows) {
        if (!settings[row.groupKey]) settings[row.groupKey] = {};
        settings[row.groupKey][row.key] = row.value;
    }

    const tokenOverrides = (customization?.overrides && typeof customization.overrides === "object"
        ? (customization.overrides as Record<string, unknown>)
        : {});

    return { themeId, mode, manifest, tokenOverrides, settings };
}

export async function setActiveTheme(themeId: string, mode: string): Promise<void> {
    await prisma.themeState.upsert({
        where: { id: 1 },
        create: { id: 1, themeId, mode },
        update: { themeId, mode },
    });
}
