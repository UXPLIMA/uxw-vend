/**
 * Forum module - sitemap contributor.
 *
 * Returns every approved ForumTopic as a sitemap entry so the core
 * /sitemap.xml endpoint can include them. Core calls this via the generated
 * ModuleSeoRoutes registry when the forum module is enabled.
 *
 * A sitemap is the most public read path there is: it hands a crawler the
 * list of URLs to fetch. It listed every topic regardless of
 * `moderationState`, so a topic still waiting on a moderator was announced
 * to search engines while the page it points at answers 404 to everyone but
 * an admin.
 */

import { prisma } from "@/core/sdk/server";
import type { SitemapEntry } from "@/core/generated/module-seo";

export default async function forumSitemap(): Promise<SitemapEntry[]> {
    try {
        const topics = await prisma.forumTopic.findMany({
            where: { moderationState: "APPROVED" },
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
