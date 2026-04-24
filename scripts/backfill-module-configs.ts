/**
 * Seed ModuleConfig rows for every directory under src/modules/ that is
 * missing one. Recovers the common "modules on disk but zero DB rows"
 * failure mode: translation service filters translations by enabled
 * module ids (src/core/lib/i18n/translation-service.ts), and the admin
 * sidebar + proxy gate also read the ModuleConfig table — so a missing
 * row hides the module from every UI surface and renders its strings
 * as raw i18n keys.
 *
 * Idempotent. Usage: npx tsx scripts/backfill-module-configs.ts
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../src/core/lib/db";

async function main() {
    const modulesDir = path.join(process.cwd(), "src/modules");
    if (!fs.existsSync(modulesDir)) {
        console.error(`modules dir not found: ${modulesDir}`);
        process.exit(1);
    }

    const dirs = fs.readdirSync(modulesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    let created = 0;
    let kept = 0;
    for (const id of dirs) {
        const manifestPath = path.join(modulesDir, id, "module.json");
        if (!fs.existsSync(manifestPath)) {
            console.log(`[${id}] skipped — no module.json`);
            continue;
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as { id?: string; name?: string; version?: string };
        const manifestId = typeof manifest.id === "string" ? manifest.id : id;
        const name = typeof manifest.name === "string" ? manifest.name : id;

        const existing = await prisma.moduleConfig.findUnique({ where: { id: manifestId } });
        if (existing) {
            kept++;
            continue;
        }

        await prisma.moduleConfig.create({
            data: {
                id: manifestId,
                name,
                enabled: true,
                installedAt: new Date(),
            },
        });
        created++;
        console.log(`[${manifestId}] created (enabled=true)`);
    }

    console.log(`\nDone. ${created} created, ${kept} already present, ${dirs.length} total directories.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
