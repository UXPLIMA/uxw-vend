/**
 * Seal the credentials that were already in the database.
 *
 * Encryption happens on write, so every save from here on stores ciphertext.
 * That leaves the rows nobody saves again: an install configured a year ago
 * whose gateway keys are working and therefore never touched. Those stay in
 * the clear until something rewrites them, which is exactly the case this
 * exists for.
 *
 * Safe to run repeatedly and safe to run on a live site. A value already
 * sealed is left alone, a value that is not a string is left alone, and an
 * empty one is left alone because an empty credential is a cleared one. It
 * needs the same SECRET_ENCRYPTION_KEY the application runs with; sealing with
 * a different key would make every credential unreadable to the app.
 *
 *   npx tsx scripts/seal-stored-credentials.ts [--dry-run]
 */
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ModuleSecretSettings } from "../src/core/generated/module-data";
import { encryptSecret, isEncrypted } from "../src/core/lib/secret-storage";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const dryRun = process.argv.includes("--dry-run");

/** Nothing to do: not a string, cleared, or sealed already. */
function needsSealing(value: unknown): value is string {
    return typeof value === "string" && value !== "" && !isEncrypted(value);
}

async function main(): Promise<void> {
    if (ModuleSecretSettings.length === 0) {
        console.log("No module declares a credential; nothing to seal.");
        return;
    }

    const containers = [...new Set(ModuleSecretSettings.map((path) => path.split(".")[0]))];
    const rows = await prisma.setting.findMany({ where: { key: { in: containers } } });

    let sealed = 0;
    let alreadyDone = 0;

    for (const row of rows) {
        const flat = ModuleSecretSettings.includes(row.key);

        if (flat) {
            if (!needsSealing(row.value)) { alreadyDone += 1; continue; }
            if (!dryRun) {
                await prisma.setting.update({
                    where: { key: row.key },
                    data: { value: encryptSecret(row.value) },
                });
            }
            console.log(`${dryRun ? "would seal" : "sealed"} ${row.key}`);
            sealed += 1;
            continue;
        }

        // A container: one or more declared fields inside a stored object.
        const value = row.value;
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const bag = { ...(value as Record<string, unknown>) };
        const fields = ModuleSecretSettings
            .filter((path) => path.startsWith(`${row.key}.`))
            .map((path) => path.slice(row.key.length + 1));

        let touched = false;
        for (const field of fields) {
            if (!needsSealing(bag[field])) { alreadyDone += 1; continue; }
            bag[field] = encryptSecret(bag[field] as string);
            touched = true;
            console.log(`${dryRun ? "would seal" : "sealed"} ${row.key}.${field}`);
            sealed += 1;
        }
        if (touched && !dryRun) {
            await prisma.setting.update({
                where: { key: row.key },
                data: { value: bag as Prisma.InputJsonValue },
            });
        }
    }

    console.log(
        `${dryRun ? "Would seal" : "Sealed"} ${sealed} credential(s); ${alreadyDone} already sealed or empty.`,
    );
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
