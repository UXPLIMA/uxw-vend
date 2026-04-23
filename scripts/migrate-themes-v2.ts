// scripts/migrate-themes-v2.ts
//
// One-shot migration: rewrites the three existing v1 theme manifests into
// the v2 shape and folds flat-dark into flat as a dark mode.
//
// Usage: npx tsx scripts/migrate-themes-v2.ts
//
// After running, flat-dark/ is removed. This script is idempotent: if a
// theme already looks v2 (schemaVersion === 2) it is skipped.

import fs from "fs";
import path from "path";

const THEMES_DIR = path.join(process.cwd(), "src/themes");

function readJson(p: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p: string, obj: unknown): void {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function migrateFlat(): void {
    const flatDir = path.join(THEMES_DIR, "flat");
    const darkDir = path.join(THEMES_DIR, "flat-dark");
    const flatPath = path.join(flatDir, "theme.json");

    if (!fs.existsSync(flatPath)) { console.log("[flat] no manifest — skipped"); return; }
    const flat = readJson(flatPath);
    if (flat.schemaVersion === 2) { console.log("[flat] already v2 — skipped"); return; }

    const dark = fs.existsSync(darkDir) ? readJson(path.join(darkDir, "theme.json")) : null;

    const lightColors: Record<string, string> = {};
    const colorDefs: Record<string, { type: "color"; group?: string; label?: string }> = {};
    for (const [name, def] of Object.entries((flat as { tokens?: { colors?: Record<string, { default?: string; group?: string; label?: string }> } }).tokens?.colors ?? {})) {
        if (def.default) lightColors[name] = def.default;
        colorDefs[name] = { type: "color", group: def.group, label: def.label };
    }

    const darkColors: Record<string, string> = { ...lightColors };
    if (dark) {
        for (const [name, def] of Object.entries((dark as { tokens?: { colors?: Record<string, { default?: string }> } }).tokens?.colors ?? {})) {
            if (def.default) darkColors[name] = def.default;
        }
    }

    const fontDefs: Record<string, { type: "font"; default?: string }> = {};
    const lightFonts: Record<string, string> = {};
    for (const [name, def] of Object.entries((flat as { tokens?: { fonts?: Record<string, { default?: string }> } }).tokens?.fonts ?? {})) {
        fontDefs[name] = { type: "font", default: def.default };
        if (def.default) lightFonts[name] = def.default;
    }

    const v2 = {
        schemaVersion: 2,
        id: "flat",
        name: "Flat",
        description: (flat as { description?: string }).description ?? "Default light theme — clean, minimal, neutral.",
        version: (flat as { version?: string }).version ?? "1.0.0",
        author: (flat as { author?: string }).author ?? "uxwVend",
        modes: {
            default: "light",
            available: {
                light: { tokens: { colors: lightColors, fonts: lightFonts } },
                dark:  { tokens: { colors: darkColors, fonts: lightFonts } },
            },
        },
        tokens: {
            colors: colorDefs,
            fonts: fontDefs,
            radius: (flat as { tokens?: { radius?: unknown } }).tokens?.radius,
        },
    };

    writeJson(flatPath, v2);
    if (fs.existsSync(darkDir)) {
        fs.rmSync(darkDir, { recursive: true, force: true });
        console.log("[flat-dark] directory removed");
    }
    console.log("[flat] migrated to v2 (light + dark)");
}

function migratePixelcraft(): void {
    const p = path.join(THEMES_DIR, "pixelcraft", "theme.json");
    if (!fs.existsSync(p)) { console.log("[pixelcraft] no manifest — skipped"); return; }
    const raw = readJson(p);
    if (raw.schemaVersion === 2) { console.log("[pixelcraft] already v2 — skipped"); return; }

    const darkColors: Record<string, string> = {};
    const colorDefs: Record<string, { type: "color"; group?: string }> = {};
    for (const [name, def] of Object.entries((raw as { tokens?: { colors?: Record<string, { default?: string; group?: string }> } }).tokens?.colors ?? {})) {
        if (def.default) darkColors[name] = def.default;
        colorDefs[name] = { type: "color", group: def.group };
    }
    const fontDefs: Record<string, { type: "font"; default?: string }> = {};
    const darkFonts: Record<string, string> = {};
    for (const [name, def] of Object.entries((raw as { tokens?: { fonts?: Record<string, { default?: string }> } }).tokens?.fonts ?? {})) {
        fontDefs[name] = { type: "font", default: def.default };
        if (def.default) darkFonts[name] = def.default;
    }

    const v2 = {
        schemaVersion: 2,
        id: "pixelcraft",
        name: "PixelCraft",
        description: (raw as { description?: string }).description ?? "Pixel-art gaming theme.",
        version: (raw as { version?: string }).version ?? "1.0.0",
        author: (raw as { author?: string }).author ?? "uxwVend",
        modes: { default: "dark", available: { dark: { tokens: { colors: darkColors, fonts: darkFonts } } } },
        tokens: { colors: colorDefs, fonts: fontDefs },
    };
    writeJson(p, v2);
    console.log("[pixelcraft] migrated to v2 (dark only)");
}

migrateFlat();
migratePixelcraft();
console.log("Done.");
