import { prisma } from "@/core/lib/db";

interface SearchResult {
    type: string;
    title: string;
    excerpt?: string;
    href: string;
    image?: string;
}

/**
 * Federated search contribution for store products.
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
        const rows = await prisma.$queryRaw<Array<{ name: string; slug: string; shortDesc: string | null; image: string | null }>>`
            SELECT name, slug, "shortDesc", image
            FROM "Product"
            WHERE "isActive" = true
              AND to_tsvector('english', coalesce(name, '') || ' ' || coalesce("shortDesc", '') || ' ' || coalesce(description, ''))
                  @@ plainto_tsquery('english', ${q})
            ORDER BY ts_rank(
                to_tsvector('english', coalesce(name, '') || ' ' || coalesce("shortDesc", '') || ' ' || coalesce(description, '')),
                plainto_tsquery('english', ${q})
            ) DESC
            LIMIT 5
        `;
        return rows.map((r) => ({
            type: "product",
            title: r.name,
            excerpt: r.shortDesc ?? undefined,
            href: `/store/${r.slug}`,
            image: r.image ?? undefined,
        }));
    } catch (err) {
        // Fallback to LIKE-based search if FTS index not ready
        console.warn(
            "[store-search] FTS failed, falling back to ILIKE:",
            err instanceof Error ? err.message : String(err)
        );
        const rows = await prisma.product.findMany({
            where: {
                AND: [
                    { isActive: true },
                    {
                        OR: [
                            { name: { contains: q, mode: "insensitive" } },
                            { shortDesc: { contains: q, mode: "insensitive" } },
                            { description: { contains: q, mode: "insensitive" } },
                        ],
                    },
                ],
            },
            select: { name: true, slug: true, shortDesc: true, image: true },
            orderBy: { createdAt: "desc" },
            take: 5,
        });
        return rows.map((r) => ({
            type: "product",
            title: r.name,
            excerpt: r.shortDesc ?? undefined,
            href: `/store/${r.slug}`,
            image: r.image ?? undefined,
        }));
    }
}
