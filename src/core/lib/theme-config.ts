import { prisma } from "./db";
import { themeRegistry, themeIds, defaultThemeId } from "@/core/generated/theme-registry";
import type { ThemeManifest } from "./theme-manifest-schema";

function extractDefaults(manifest: ThemeManifest): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [group, groupDef] of Object.entries(manifest.config ?? {})) {
        out[group] = {};
        for (const [field, def] of Object.entries(groupDef.fields)) {
            if ("default" in def && def.default !== undefined) {
                (out[group] as Record<string, unknown>)[field] = def.default;
            }
        }
    }
    return out;
}

function mergeDeep(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
        if (v && typeof v === "object" && !Array.isArray(v)
            && typeof out[k] === "object" && out[k] !== null && !Array.isArray(out[k])) {
            out[k] = mergeDeep(out[k] as Record<string, unknown>, v as Record<string, unknown>);
        } else {
            out[k] = v;
        }
    }
    return out;
}

export async function getActiveThemeId(): Promise<string> {
    try {
        const row = await prisma.setting.findUnique({ where: { key: "active_theme" } });
        const raw = row?.value as { id?: unknown; active_theme?: unknown } | string | undefined;
        let id: string | undefined;
        if (typeof raw === "string") id = raw;
        else if (raw && typeof raw === "object") {
            const candidate = (raw as { id?: unknown; active_theme?: unknown }).id
                ?? (raw as { id?: unknown; active_theme?: unknown }).active_theme;
            if (typeof candidate === "string") id = candidate;
        }
        if (id && (themeIds as readonly string[]).includes(id)) return id;
    } catch { /* fall through to default */ }
    return defaultThemeId;
}

export async function getThemeConfig(): Promise<{
    themeId: string;
    manifest: ThemeManifest;
    config: Record<string, unknown>;
}> {
    const themeId = await getActiveThemeId();
    const manifest = themeRegistry[themeId]
        ?? themeRegistry[defaultThemeId]
        ?? Object.values(themeRegistry)[0];
    const defaults = extractDefaults(manifest);
    let overrides: Record<string, unknown> = {};
    try {
        const row = await prisma.themeCustomization.findUnique({ where: { themeId } });
        if (row && row.overrides && typeof row.overrides === "object" && !Array.isArray(row.overrides)) {
            overrides = row.overrides as Record<string, unknown>;
        }
    } catch { /* no customization yet */ }
    return { themeId, manifest, config: mergeDeep(defaults, overrides) };
}

export { ThemeConfigProvider, useThemeConfig, type ThemeConfigValue } from "./theme-config-client";
