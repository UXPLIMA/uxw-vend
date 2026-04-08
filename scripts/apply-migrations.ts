/**
 * Per-module SQL migration runner.
 *
 * See docs/MIGRATIONS.md for the design.
 *
 * Walks each installed module's migrations/ directory, applies any
 * migration not yet recorded in the ModuleMigration table, and records
 * the checksum + execution time.
 *
 * Usage:
 *   npx tsx scripts/apply-migrations.ts                 # all installed modules
 *   npx tsx scripts/apply-migrations.ts --module=blog   # one module
 *   npx tsx scripts/apply-migrations.ts --dry-run       # preview only
 *   npx tsx scripts/apply-migrations.ts --bootstrap     # mark-as-applied without running
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../src/core/lib/db";

const ROOT = process.cwd();
const MODULE_SOURCES_DIR = path.join(ROOT, "module-sources");
const INSTALLED_MODULES_DIR = path.join(ROOT, "src/modules");

interface Options {
    moduleFilter: string | null;
    dryRun: boolean;
    bootstrap: boolean;
}

function parseArgs(): Options {
    const args = process.argv.slice(2);
    const moduleArg = args.find((a) => a.startsWith("--module="));
    return {
        moduleFilter: moduleArg ? moduleArg.slice("--module=".length) : null,
        dryRun: args.includes("--dry-run"),
        bootstrap: args.includes("--bootstrap"),
    };
}

function getInstalledModules(): string[] {
    if (!fs.existsSync(INSTALLED_MODULES_DIR)) return [];
    return fs
        .readdirSync(INSTALLED_MODULES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
}

/** Resolve migrations directory: prefer installed copy, fall back to module-sources. */
function getMigrationsDir(moduleName: string): string | null {
    const installed = path.join(INSTALLED_MODULES_DIR, moduleName, "migrations");
    if (fs.existsSync(installed)) return installed;
    const source = path.join(MODULE_SOURCES_DIR, moduleName, "migrations");
    if (fs.existsSync(source)) return source;
    return null;
}

function listMigrationFiles(dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
}

function sha256(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
}

interface ApplyResult {
    moduleId: string;
    applied: string[];
    skipped: string[];
    errors: { migration: string; error: string }[];
}

async function applyModuleMigrations(
    moduleId: string,
    options: Options
): Promise<ApplyResult> {
    const result: ApplyResult = { moduleId, applied: [], skipped: [], errors: [] };

    const migrationsDir = getMigrationsDir(moduleId);
    if (!migrationsDir) return result;

    const files = listMigrationFiles(migrationsDir);
    if (files.length === 0) return result;

    const existingRecords = await prisma.moduleMigration.findMany({
        where: { moduleId },
    });
    const appliedMap = new Map<string, string>();
    for (const r of existingRecords) {
        appliedMap.set(r.migrationName, r.checksum);
    }

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const checksum = sha256(content);

        const existingChecksum = appliedMap.get(file);
        if (existingChecksum !== undefined) {
            if (existingChecksum !== checksum) {
                result.errors.push({
                    migration: file,
                    error: `Checksum mismatch — file was modified after it was applied. Do not edit applied migrations; write a new one instead.`,
                });
                return result; // Abort this module
            }
            result.skipped.push(file);
            continue;
        }

        if (options.dryRun) {
            console.log(`  [dry-run] would apply ${moduleId}/${file}`);
            continue;
        }

        if (options.bootstrap) {
            // Mark as applied without running
            await prisma.moduleMigration.create({
                data: { moduleId, migrationName: file, checksum, executionMs: 0 },
            });
            result.applied.push(file);
            console.log(`  [bootstrap] marked ${moduleId}/${file} as applied (not executed)`);
            continue;
        }

        // Apply the migration inside a transaction
        const start = Date.now();
        try {
            // Split on semicolons at end of lines to support multi-statement files,
            // but respect dollar-quoted strings (functions). Simple split is fine
            // for the 99% case; complex procedures should be one-statement files.
            await prisma.$transaction(async (tx) => {
                await tx.$executeRawUnsafe(content);
            });
            const executionMs = Date.now() - start;

            await prisma.moduleMigration.create({
                data: { moduleId, migrationName: file, checksum, executionMs },
            });
            result.applied.push(file);
            console.log(`  applied ${moduleId}/${file} (${executionMs}ms)`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            result.errors.push({ migration: file, error: message });
            console.error(`  FAILED ${moduleId}/${file}: ${message}`);
            return result; // Abort this module on first failure — do not skip ahead
        }
    }

    return result;
}

/** Main entry. Also exported so the install route can call it directly. */
export async function applyMigrations(options: Options = { moduleFilter: null, dryRun: false, bootstrap: false }): Promise<ApplyResult[]> {
    const modules = options.moduleFilter
        ? [options.moduleFilter]
        : getInstalledModules();

    const results: ApplyResult[] = [];
    for (const moduleId of modules) {
        const migrationsDir = getMigrationsDir(moduleId);
        if (!migrationsDir) continue;
        console.log(`\n[${moduleId}]`);
        const result = await applyModuleMigrations(moduleId, options);
        results.push(result);
    }

    return results;
}

// CLI entrypoint
if (require.main === module) {
    (async () => {
        const options = parseArgs();
        console.log("Migration runner starting...");
        if (options.dryRun) console.log("Mode: DRY RUN (no changes will be applied)");
        if (options.bootstrap) console.log("Mode: BOOTSTRAP (mark existing as applied without running)");
        if (options.moduleFilter) console.log(`Filter: ${options.moduleFilter}`);

        const results = await applyMigrations(options);

        const totalApplied = results.reduce((sum, r) => sum + r.applied.length, 0);
        const totalSkipped = results.reduce((sum, r) => sum + r.skipped.length, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

        console.log(`\n── Summary ──`);
        console.log(`Applied: ${totalApplied}`);
        console.log(`Already up-to-date: ${totalSkipped}`);
        console.log(`Errors: ${totalErrors}`);

        if (totalErrors > 0) {
            for (const r of results) {
                for (const e of r.errors) {
                    console.error(`  ${r.moduleId}/${e.migration}: ${e.error}`);
                }
            }
            process.exit(1);
        }

        process.exit(0);
    })();
}
