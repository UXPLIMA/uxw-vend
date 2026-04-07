/**
 * Ensures core message files contain core namespaces + installed module translations.
 * 1. Strips everything to core-only
 * 2. Re-merges translations from installed modules' manifests
 *    - Module namespaces (store, forum, etc.) are added directly
 *    - Protected namespaces (admin, common, etc.) are DEEP MERGED, not overwritten
 *
 * Uses the same deep merge strategy as the install route's safeMerge to ensure
 * consistent results regardless of which code path runs.
 *
 * Runs on predev/prebuild to keep translations in sync with installed modules.
 */

import fs from "fs";
import path from "path";

/** Deep merge two objects recursively — same logic as install route safeMerge */
function deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
): Record<string, unknown> {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (
            typeof value === "object" && value !== null && !Array.isArray(value) &&
            typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])
        ) {
            result[key] = deepMerge(
                result[key] as Record<string, unknown>,
                value as Record<string, unknown>
            );
        } else {
            result[key] = value;
        }
    }
    return result;
}

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const MODULES_DIR = path.join(process.cwd(), "src/modules");
const CORE_NAMESPACES = ["common", "nav", "hero", "admin", "footer", "auth"];

const files = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json"));

// Step 1: Strip to core-only
for (const file of files) {
    const filePath = path.join(MESSAGES_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const coreOnly: Record<string, unknown> = {};
    for (const ns of CORE_NAMESPACES) {
        if (data[ns]) coreOnly[ns] = data[ns];
    }
    fs.writeFileSync(filePath, JSON.stringify(coreOnly, null, 2));
}

// Step 2: Re-merge installed module translations
if (!fs.existsSync(MODULES_DIR)) {
    console.log("Translation files synced (no modules installed)");
    process.exit(0);
}

const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

let merged = 0;
for (const mod of modules) {
    const manifestPath = path.join(MODULES_DIR, mod.name, "module.json");
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (!manifest.translations) continue;

    for (const [locale, translations] of Object.entries(manifest.translations as Record<string, Record<string, unknown>>)) {
        const msgPath = path.join(MESSAGES_DIR, `${locale}.json`);
        if (!fs.existsSync(msgPath)) continue;

        const existing = JSON.parse(fs.readFileSync(msgPath, "utf-8"));

        for (const [key, value] of Object.entries(translations)) {
            if (CORE_NAMESPACES.includes(key)) {
                // Deep merge into protected namespace (e.g. admin.menu_store)
                existing[key] = deepMerge(
                    (existing[key] as Record<string, unknown>) || {},
                    value as Record<string, unknown>
                );
            } else {
                // Module namespace — add directly
                existing[key] = value;
            }
        }

        fs.writeFileSync(msgPath, JSON.stringify(existing, null, 2));
    }
    merged++;
}

console.log(`Translation files synced: ${modules.length} modules checked, ${merged} merged`);
