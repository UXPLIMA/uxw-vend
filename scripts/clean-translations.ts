/**
 * Cleans module-specific translation keys from core message files.
 * Core message files should ONLY contain these namespaces:
 *   common, nav, hero, admin, footer, auth
 *
 * Runs automatically on predev/prebuild to prevent module translations
 * from leaking into core (happens when modules are installed for testing).
 */

import fs from "fs";
import path from "path";

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const CORE_NAMESPACES = ["common", "nav", "hero", "admin", "footer", "auth"];

const files = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json"));
let cleaned = 0;

for (const file of files) {
    const filePath = path.join(MESSAGES_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const keys = Object.keys(data);
    const moduleKeys = keys.filter((k) => !CORE_NAMESPACES.includes(k));

    if (moduleKeys.length > 0) {
        const coreOnly: Record<string, unknown> = {};
        for (const ns of CORE_NAMESPACES) {
            if (data[ns]) coreOnly[ns] = data[ns];
        }
        fs.writeFileSync(filePath, JSON.stringify(coreOnly, null, 2));
        console.log(`Cleaned ${file}: removed ${moduleKeys.length} module keys (${moduleKeys.join(", ")})`);
        cleaned++;
    }
}

if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} files`);
} else {
    console.log("Translation files clean — no module keys found");
}
