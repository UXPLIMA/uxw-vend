import { prisma } from "@/core/lib/db";
import { ModuleSearchIndexes } from "@/core/generated/module-search";

/**
 * Idempotent creation of GIN tsvector indexes for module searchable tables.
 * Runs once per process from src/instrumentation.ts, or manually via
 * `npx tsx scripts/ensure-search-indexes.ts`.
 *
 * The table list is generated from module manifests, not written here. It used
 * to be a hardcoded array naming `BlogArticle`, `ForumTopic`, `HelpArticle`
 * and `Product` — four module tables named in core, which is the one thing
 * this project's architecture forbids, and which logged an error per
 * uninstalled module on every single boot.
 *
 * Identifiers reach here from `module.json`, validated against
 * `^[A-Za-z][A-Za-z0-9_]*$` by the manifest schema before a module can be
 * installed. That is what makes the interpolation below safe; the expression
 * itself is built by core, so a module never supplies SQL.
 */
function ftsExpression(columns: string[]): string {
    return `to_tsvector('english', ${columns
        .map((c) => `coalesce("${c}", '')`)
        .join(" || ' ' || ")})`;
}

async function ensureIndexes(): Promise<void> {
    for (const idx of ModuleSearchIndexes) {
        const table = `"${idx.table}"`;
        const name = `"${idx.table}_fts_idx"`;
        try {
            // A module can be installed but not yet migrated. Probe first so a
            // missing table is a skip rather than a failed CREATE INDEX.
            await prisma.$executeRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`);
            await prisma.$executeRawUnsafe(
                `CREATE INDEX IF NOT EXISTS ${name} ON ${table} USING GIN (${ftsExpression(idx.columns)})`
            );
            console.log(`[search-indexes] ensured ${name} for ${idx.module}`);
        } catch (err) {
            console.warn(
                `[search-indexes] skipped ${name}:`,
                err instanceof Error ? err.message : String(err)
            );
        }
    }
}

// CLI entrypoint
if (require.main === module) {
    ensureIndexes()
        .then(() => prisma.$disconnect())
        .catch((err) => {
            console.error("[search-indexes] fatal:", err);
            process.exit(1);
        });
}

export { ensureIndexes, ftsExpression };
