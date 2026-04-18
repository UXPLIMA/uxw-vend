/**
 * Help Center module — sitemap contributor.
 *
 * Returns every active HelpArticle as a sitemap entry. Core calls this
 * via the generated ModuleSeoRoutes registry when the help-center module
 * is enabled.
 */

import { prisma } from "@/core/lib/db";
import type { SitemapEntry } from "@/core/generated/module-seo";

export default async function helpCenterSitemap(): Promise<SitemapEntry[]> {
    try {
        const articles = await prisma.helpArticle.findMany({
            where: { isActive: true },
            select: {
                slug: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 5000,
        });

        return articles.map((a) => ({
            url: `/help/${a.slug}`,
            lastModified: a.updatedAt,
            changeFreq: "monthly" as const,
            priority: 0.5,
        }));
    } catch {
        return [];
    }
}
