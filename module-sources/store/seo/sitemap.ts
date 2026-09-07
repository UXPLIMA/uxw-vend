/**
 * Store module - sitemap contributor.
 *
 * A product page answers an anonymous request and is the store's indexable
 * content in the way an article is the blog's, but the store contributed
 * nothing, so `/sitemap.xml` listed the shelf and never a thing on it.
 *
 * Core calls this through the generated `ModuleSeoRoutes` registry, and only
 * while the store is enabled. The locale prefix is core's to add: entries are
 * returned as the module's own paths, the same shape the blog returns.
 */

import { prisma } from "@/core/sdk/server";
import type { SitemapEntry } from "@/core/generated/module-seo";

/** What a sitemap can carry without becoming a page nobody can serve. */
const MAX_ENTRIES = 5000;

export default async function storeSitemap(): Promise<SitemapEntry[]> {
    try {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            select: { slug: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: MAX_ENTRIES,
        });

        return products.map((p) => ({
            url: `/store/product/${p.slug}`,
            lastModified: p.updatedAt,
            changeFreq: "weekly" as const,
            priority: 0.7,
        }));
    } catch {
        // A sitemap that cannot be built is not a page that should fail: core
        // merges what every module returns, and one of them being unable to
        // read must not take the others out with it.
        return [];
    }
}
