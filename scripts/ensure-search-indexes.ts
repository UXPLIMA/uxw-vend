import { prisma } from "@/core/lib/db";

/**
 * Idempotent creation of GIN tsvector indexes for module searchable tables.
 * Run from the scheduler on startup or manually via `npx tsx scripts/ensure-search-indexes.ts`.
 */
const INDEXES = [
    {
        table: '"BlogArticle"',
        name: '"BlogArticle_fts_idx"',
        expression: `to_tsvector('english', coalesce("title", '') || ' ' || coalesce("excerpt", '') || ' ' || coalesce("content", ''))`,
    },
    {
        table: '"ForumTopic"',
        name: '"ForumTopic_fts_idx"',
        expression: `to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))`,
    },
    {
        table: '"HelpArticle"',
        name: '"HelpArticle_fts_idx"',
        expression: `to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))`,
    },
    {
        table: '"Product"',
        name: '"Product_fts_idx"',
        expression: `to_tsvector('english', coalesce("name", '') || ' ' || coalesce("shortDesc", '') || ' ' || coalesce("description", ''))`,
    },
];

async function ensureIndexes(): Promise<void> {
    for (const idx of INDEXES) {
        try {
            // Test if the table exists first (modules may not be installed)
            await prisma.$executeRawUnsafe(`SELECT 1 FROM ${idx.table} LIMIT 1`);
            await prisma.$executeRawUnsafe(
                `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table} USING GIN (${idx.expression})`
            );
            console.log(`[search-indexes] ensured ${idx.name}`);
        } catch (err) {
            console.warn(
                `[search-indexes] skipped ${idx.name}:`,
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

export { ensureIndexes };
