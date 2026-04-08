/**
 * Generates messages/[locale].json from messages-core/[locale].json
 * + translations from installed modules' manifests.
 *
 * messages-core/ contains the canonical core-only translations (committed to git).
 * messages/ is generated and gitignored — never edit by hand.
 *
 * Module namespaces (store, forum, etc.) are added directly.
 * Core namespaces (admin, common, etc.) are DEEP MERGED so module-supplied
 * sub-keys (e.g. admin.menu_store) extend core without overwriting.
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
const CORE_DIR = path.join(process.cwd(), "messages-core");
const MODULES_DIR = path.join(process.cwd(), "src/modules");
const CORE_NAMESPACES = ["common", "nav", "hero", "admin", "footer", "auth"];

if (!fs.existsSync(CORE_DIR)) {
    console.error("messages-core/ directory not found — cannot regenerate translations");
    process.exit(1);
}

if (!fs.existsSync(MESSAGES_DIR)) {
    fs.mkdirSync(MESSAGES_DIR, { recursive: true });
}

// Step 1: Reset messages/ from messages-core/ baseline
const coreFiles = fs.readdirSync(CORE_DIR).filter((f) => f.endsWith(".json"));
for (const file of coreFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(CORE_DIR, file), "utf-8"));
    fs.writeFileSync(path.join(MESSAGES_DIR, file), JSON.stringify(data, null, 2));
}

// Step 2: Merge installed module translations
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
                existing[key] = deepMerge(
                    (existing[key] as Record<string, unknown>) || {},
                    value as Record<string, unknown>
                );
            } else {
                existing[key] = value;
            }
        }

        fs.writeFileSync(msgPath, JSON.stringify(existing, null, 2));
    }
    merged++;
}

console.log(`Translation files synced: ${modules.length} modules checked, ${merged} merged`);
