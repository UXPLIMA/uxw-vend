import { prisma } from "@/core/sdk/server";

interface SearchResult {
    type: string;
    title: string;
    excerpt?: string;
    href: string;
}

/**
 * Federated search contribution for blog articles.
 * Called from /api/v1/search?q=... via the ModuleSearchProviders registry.
 *
 * Uses PostgreSQL full-text search via a GIN tsvector index for O(log n)
 * lookups. Falls back to ILIKE-based contains() queries if the FTS index
 * is not yet present (e.g. fresh install before ensureIndexes() has run).
 *
 * Both paths repeat the visibility rule the public endpoints apply. PUBLISHED
 * on its own is not "visible": `publishedAt` can be stamped in the future by
 * a caller who passes one, and a `publishAt` left over from a schedule
 * survives a status change that does not mention it. The list endpoint and
 * the single-article endpoint both test the dates, so search does as well.
 */
export default async function search(q: string): Promise<SearchResult[]> {
    if (!q || q.length < 2) return [];

    try {
        // Full-text path
        const rows = await prisma.$queryRaw<Array<{ title: string; slug: string; excerpt: string | null }>>`
            SELECT title, slug, excerpt
            FROM "BlogArticle"
            WHERE status = 'PUBLISHED'
              AND "publishedAt" <= NOW()
              AND ("publishAt" IS NULL OR "publishAt" <= NOW())
              AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, ''))
                  @@ plainto_tsquery('english', ${q})
            ORDER BY ts_rank(
                to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, '')),
                plainto_tsquery('english', ${q})
            ) DESC
            LIMIT 5
        `;
        return rows.map((r) => ({
            type: "blog-article",
            title: r.title,
            excerpt: r.excerpt ?? undefined,
            href: `/blog/${r.slug}`,
        }));
    } catch (err) {
        // Fallback to LIKE-based search if FTS index not ready
        console.warn(
            "[blog-search] FTS failed, falling back to ILIKE:",
            err instanceof Error ? err.message : String(err)
        );
        const rows = await prisma.blogArticle.findMany({
            where: {
                AND: [
                    { status: "PUBLISHED" },
                    { publishedAt: { lte: new Date() } },
                    { OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
                    {
                        OR: [
                            { title: { contains: q, mode: "insensitive" } },
                            { excerpt: { contains: q, mode: "insensitive" } },
                            { content: { contains: q, mode: "insensitive" } },
                        ],
                    },
                ],
            },
            select: { title: true, slug: true, excerpt: true },
            orderBy: { createdAt: "desc" },
            take: 5,
        });
        return rows.map((r) => ({
            type: "blog-article",
            title: r.title,
            excerpt: r.excerpt ?? undefined,
            href: `/blog/${r.slug}`,
        }));
    }
}
