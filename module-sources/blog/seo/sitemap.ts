/**
 * Blog module — sitemap contributor.
 *
 * Returns every published BlogArticle as a sitemap entry so the core
 * /sitemap.xml endpoint can include them. Core calls this via the
 * generated ModuleSeoRoutes registry when the blog module is enabled.
 */

import { prisma } from "@/core/lib/db";
import type { SitemapEntry } from "@/core/generated/module-seo";

export default async function blogSitemap(): Promise<SitemapEntry[]> {
    try {
        const articles = await prisma.blogArticle.findMany({
            where: {
                status: "PUBLISHED",
                publishedAt: { lte: new Date() },
            },
            select: {
                slug: true,
                updatedAt: true,
            },
            orderBy: { publishedAt: "desc" },
            take: 5000,
        });

        return articles.map((a) => ({
            url: `/blog/${a.slug}`,
            lastModified: a.updatedAt,
            changeFreq: "weekly" as const,
            priority: 0.8,
        }));
    } catch {
        return [];
    }
}
