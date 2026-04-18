import { prisma } from "@/core/lib/db";

interface SearchResult {
    type: string;
    title: string;
    excerpt?: string;
    href: string;
}

/**
 * Federated search contribution for forum topics.
 * Called from /api/v1/search?q=... via the ModuleSearchProviders registry.
 *
 * Uses PostgreSQL full-text search via a GIN tsvector index for O(log n)
 * lookups. Falls back to ILIKE-based contains() queries if the FTS index
 * is not yet present.
 */
export default async function search(q: string): Promise<SearchResult[]> {
    if (!q || q.length < 2) return [];

    try {
        // Full-text path
        const rows = await prisma.$queryRaw<Array<{ title: string; slug: string; content: string }>>`
            SELECT title, slug, content
            FROM "ForumTopic"
            WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
                  @@ plainto_tsquery('english', ${q})
            ORDER BY ts_rank(
                to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')),
                plainto_tsquery('english', ${q})
            ) DESC
            LIMIT 5
        `;
        return rows.map((r) => ({
            type: "forum-topic",
            title: r.title,
            excerpt: r.content.slice(0, 140),
            href: `/forum/topic/${r.slug}`,
        }));
    } catch (err) {
        // Fallback to LIKE-based search if FTS index not ready
        console.warn(
            "[forum-search] FTS failed, falling back to ILIKE:",
            err instanceof Error ? err.message : String(err)
        );
        const rows = await prisma.forumTopic.findMany({
            where: {
                OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { content: { contains: q, mode: "insensitive" } },
                ],
            },
            select: { title: true, slug: true, content: true },
            orderBy: { createdAt: "desc" },
            take: 5,
        });
        return rows.map((r) => ({
            type: "forum-topic",
            title: r.title,
            excerpt: r.content.slice(0, 140),
            href: `/forum/topic/${r.slug}`,
        }));
    }
}
