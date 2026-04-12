/**
 * Seed core translations from messages-core/*.json into the Translation table.
 * Also seeds translations from all installed modules' module.json manifests.
 *
 * Idempotent — safe to run multiple times. Upserts, never duplicates.
 *
 * Usage: npx tsx scripts/seed-translations.ts
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const CORE_DIR = path.join(process.cwd(), "messages-core");
const MODULES_DIR = path.join(process.cwd(), "src/modules");

function flattenObject(
    obj: Record<string, unknown>,
    prefix: string,
    emit: (key: string, value: string) => void,
): void {
    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            flattenObject(v as Record<string, unknown>, fullKey, emit);
        } else {
            emit(fullKey, String(v ?? ""));
        }
    }
}

async function seedLocale(
    locale: string,
    data: Record<string, unknown>,
    moduleId: string,
): Promise<number> {
    const rows: { locale: string; namespace: string; key: string; value: string; module: string }[] = [];

    for (const [namespace, content] of Object.entries(data)) {
        if (typeof content === "string") {
            rows.push({ locale, namespace, key: "_root", value: content, module: moduleId });
        } else if (typeof content === "object" && content !== null) {
            flattenObject(content as Record<string, unknown>, "", (key, value) => {
                rows.push({ locale, namespace, key, value, module: moduleId });
            });
        }
    }

    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        await Promise.all(
            chunk.map((r) =>
                prisma.translation.upsert({
                    where: {
                        locale_namespace_key_module: {
                            locale: r.locale,
                            namespace: r.namespace,
                            key: r.key,
                            module: r.module,
                        },
                    },
                    update: { value: r.value },
                    create: r,
                }),
            ),
        );
    }

    return rows.length;
}

async function main() {
    console.log("Seeding translations...\n");

    // 1. Core translations
    if (!fs.existsSync(CORE_DIR)) {
        console.error("messages-core/ not found");
        process.exit(1);
    }

    const coreFiles = fs.readdirSync(CORE_DIR).filter((f) => f.endsWith(".json"));
    let coreTotal = 0;
    for (const file of coreFiles) {
        const locale = file.replace(".json", "");
        const data = JSON.parse(fs.readFileSync(path.join(CORE_DIR, file), "utf-8"));
        const count = await seedLocale(locale, data, "core");
        coreTotal += count;
        console.log(`  core/${locale}: ${count} keys`);
    }
    console.log(`  Core total: ${coreTotal} keys\n`);

    // 2. Module translations
    if (!fs.existsSync(MODULES_DIR)) {
        console.log("No modules installed. Done.");
        return;
    }

    const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory());

    let modTotal = 0;
    for (const mod of modules) {
        const manifestPath = path.join(MODULES_DIR, mod.name, "module.json");
        if (!fs.existsSync(manifestPath)) continue;

        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        const moduleId = manifest.id || mod.name;
        const translations = manifest.translations;
        if (!translations || typeof translations !== "object") continue;

        let modCount = 0;
        for (const [locale, data] of Object.entries(translations as Record<string, Record<string, unknown>>)) {
            if (typeof data !== "object" || data === null) continue;
            const count = await seedLocale(locale, data, moduleId);
            modCount += count;
        }

        if (modCount > 0) {
            console.log(`  ${moduleId}: ${modCount} keys`);
            modTotal += modCount;
        }
    }

    console.log(`  Module total: ${modTotal} keys`);
    console.log(`\nDone. ${coreTotal + modTotal} total translation keys seeded.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
