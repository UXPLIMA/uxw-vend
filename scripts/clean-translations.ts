/**
 * Ensures core message files contain ONLY core namespaces + installed module translations.
 * 1. Strips everything to core-only
 * 2. Re-merges translations from installed modules' module.json manifests
 *
 * Runs on predev/prebuild to keep translations in sync with installed modules.
 */

import fs from "fs";
import path from "path";

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
        // Remove protected core keys from module translations
        const sanitized = { ...translations };
        for (const key of CORE_NAMESPACES) delete sanitized[key];

        fs.writeFileSync(msgPath, JSON.stringify({ ...existing, ...sanitized }, null, 2));
    }
    merged++;
}

console.log(`Translation files synced: ${modules.length} modules checked, ${merged} merged`);
