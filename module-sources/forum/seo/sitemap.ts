/**
 * Forum module — sitemap contributor.
 *
 * Returns every ForumTopic as a sitemap entry so the core /sitemap.xml
 * endpoint can include them. Core calls this via the generated
 * ModuleSeoRoutes registry when the forum module is enabled.
 */

import { prisma } from "@/core/lib/db";
import type { SitemapEntry } from "@/core/generated/module-seo";

export default async function forumSitemap(): Promise<SitemapEntry[]> {
    try {
        const topics = await prisma.forumTopic.findMany({
            select: {
                slug: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 5000,
        });

        return topics.map((t) => ({
            url: `/forum/topic/${t.slug}`,
            lastModified: t.updatedAt,
            changeFreq: "daily" as const,
            priority: 0.6,
        }));
    } catch {
        return [];
    }
}
