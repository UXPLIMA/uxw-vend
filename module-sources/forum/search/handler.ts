import { log, prisma } from "@/core/sdk/server";
import { mayViewForum } from "../lib/guest-view";

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
 *
 * Both paths repeat the visibility rules the public endpoints apply, because
 * a search result is a way into the content and not a lesser view of it:
 * whether the forum is open to guests at all, and then whether the topic has
 * been approved.
 * `/api/v1/forum/topics` hides anything but APPROVED from a non-admin, and
 * the single-topic endpoint answers 404 for one - a search that skipped the
 * same test handed an anonymous visitor the title and the first 140
 * characters of a topic still waiting on a moderator, linking to a page that
 * would then refuse to show it.
 */
export default async function search(q: string): Promise<SearchResult[]> {
    if (!q || q.length < 2) return [];

    // The other half of the visibility rule, and the half this file used to
    // skip. A forum an operator has closed answers 403 at its own endpoints;
    // a search that did not ask handed a stranger the title and the opening
    // of every topic in it. Asked before the query, because a result that
    // cannot be shown is a query worth not running.
    if (!(await mayViewForum())) return [];

    try {
        // Full-text path
        const rows = await prisma.$queryRaw<Array<{ title: string; slug: string; content: string }>>`
            SELECT title, slug, content
            FROM "ForumTopic"
            WHERE "moderationState" = 'APPROVED'
              AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
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
        log.warn("[forum-search] FTS failed, falling back to ILIKE", {
            error: err instanceof Error ? err.message : String(err),
        });
        const rows = await prisma.forumTopic.findMany({
            where: {
                AND: [
                    { moderationState: "APPROVED" },
                    {
                        OR: [
                            { title: { contains: q, mode: "insensitive" } },
                            { content: { contains: q, mode: "insensitive" } },
                        ],
                    },
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
