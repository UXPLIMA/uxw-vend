import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isSetupComplete } from "@/core/lib/setup-state";
import { parseSetupPresets, CUSTOM_PRESET } from "@/core/lib/setup-presets";

/**
 * Site-type presets for the first-run wizard.
 *
 * Reads `module-marketplace/presets.json` as data, the same way the module
 * catalog is read — core itself names no module. A missing or malformed file
 * degrades to the manual path rather than blocking setup.
 */
const PRESETS_PATH = path.join(process.cwd(), "module-marketplace", "presets.json");
const CATALOG_PATH = path.join(process.cwd(), "module-marketplace", "index.json");

export async function GET() {
    if (await isSetupComplete()) {
        return NextResponse.json({ error: "Setup has already been completed." }, { status: 409 });
    }

    let knownModuleIds: string[] | undefined;
    try {
        const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8")) as {
            modules?: Array<{ id: string }>;
        };
        knownModuleIds = catalog.modules?.map((m) => m.id);
    } catch {
        // No catalog to cross-check against: keep every id the preset names
        // rather than dropping them all.
        knownModuleIds = undefined;
    }

    let raw: unknown;
    try {
        raw = JSON.parse(await fs.readFile(PRESETS_PATH, "utf8"));
    } catch {
        return NextResponse.json({ presets: [CUSTOM_PRESET] });
    }

    const presets = parseSetupPresets(raw, {
        knownModuleIds,
        onWarn: (m) => console.warn(m),
    });
    return NextResponse.json({ presets });
}
