import type { MetadataRoute } from "next";
import { prisma } from "@/core/lib/db";
import moduleSystem from "@/core/lib/modules";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Load module states from DB
    try {
        const dbModuleConfigs = await prisma.moduleConfig.findMany();
        await moduleSystem.initialize(dbModuleConfigs.map(mc => ({ id: mc.id, enabled: mc.enabled, config: mc.config as Record<string, unknown> })));
    } catch { /* DB might not be ready */ }

    const storeEnabled = moduleSystem.isEnabled("store");
    const blogEnabled = moduleSystem.isEnabled("blog");
    const forumEnabled = moduleSystem.isEnabled("forum");
    const supportEnabled = moduleSystem.isEnabled("support");

    // Static pages — filter module-specific paths
    const modulePages: Record<string, string[]> = {
        store: ["/store", "/store/vip"],
        blog: ["/blog"],
        forum: ["/forum"],
        support: ["/support", "/help"],
    };

    const staticPages = [
        "",
        "/changelog",
        "/staff",
        "/suggestions",
        "/downloads",
        "/punishments",
        "/wheel",
        ...(storeEnabled ? modulePages.store : []),
        ...(blogEnabled ? modulePages.blog : []),
        ...(forumEnabled ? modulePages.forum : []),
        ...(supportEnabled ? modulePages.support : []),
    ];

    const entries: MetadataRoute.Sitemap = staticPages.map((path) => ({
        url: `${baseUrl}/en${path}`,
        lastModified: new Date(),
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1 : 0.8,
    }));

    // Blog articles
    if (blogEnabled) {
        try {
            const articles = await prisma.blogArticle.findMany({
                where: { status: "PUBLISHED" },
                select: { number: true, slug: true, updatedAt: true },
            });
            for (const article of articles) {
                entries.push({
                    url: `${baseUrl}/en/blog/${article.number}/${article.slug}`,
                    lastModified: article.updatedAt,
                    changeFrequency: "weekly",
                    priority: 0.7,
                });
            }
        } catch { /* DB might not be ready */ }
    }

    // Products
    if (storeEnabled) {
        try {
            const products = await prisma.product.findMany({
                where: { isActive: true },
                select: { number: true, slug: true, updatedAt: true },
            });
            for (const product of products) {
                entries.push({
                    url: `${baseUrl}/en/store/product/${product.number}/${product.slug}`,
                    lastModified: product.updatedAt as Date,
                    changeFrequency: "weekly",
                    priority: 0.7,
                });
            }
        } catch { /* DB might not be ready */ }
    }

    // Forum topics
    if (forumEnabled) {
        try {
            const topics = await prisma.forumTopic.findMany({
                select: { number: true, slug: true, updatedAt: true },
                take: 100,
                orderBy: { createdAt: "desc" },
            });
            for (const topic of topics) {
                entries.push({
                    url: `${baseUrl}/en/forum/topic/${topic.number}/${topic.slug}`,
                    lastModified: topic.updatedAt,
                    changeFrequency: "daily",
                    priority: 0.6,
                });
            }
        } catch { /* DB might not be ready */ }
    }

    // Custom pages
    try {
        const pages = await prisma.customPage.findMany({
            where: { isActive: true },
            select: { slug: true, updatedAt: true },
        });
        for (const page of pages) {
            entries.push({
                url: `${baseUrl}/en/page/${page.slug}`,
                lastModified: page.updatedAt,
                changeFrequency: "monthly",
                priority: 0.5,
            });
        }
    } catch { /* DB might not be ready */ }

    return entries;
}
