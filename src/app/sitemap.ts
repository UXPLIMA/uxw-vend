import type { MetadataRoute } from "next";
import { prisma } from "@/core/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Static core pages
    const staticPages = [
        "",
        "/changelog",
        "/staff",
        "/suggestions",
        "/downloads",
        "/punishments",
        "/wheel",
    ];

    // Dynamically discover module pages by querying their data
    // If a module's tables exist and have data, include its pages
    try {
        const products = await prisma.product.findFirst({ where: { isActive: true } });
        if (products) staticPages.push("/store", "/store/vip");
    } catch { /* model unavailable */ }

    try {
        const article = await prisma.blogArticle.findFirst({ where: { status: "PUBLISHED" } });
        if (article) staticPages.push("/blog");
    } catch { /* model unavailable */ }

    try {
        const topic = await prisma.forumTopic.findFirst();
        if (topic) staticPages.push("/forum");
    } catch { /* model unavailable */ }

    try {
        const ticket = await prisma.ticket.findFirst();
        if (ticket) staticPages.push("/support", "/help");
    } catch { /* model unavailable */ }

    const entries: MetadataRoute.Sitemap = staticPages.map((path) => ({
        url: `${baseUrl}/en${path}`,
        lastModified: new Date(),
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1 : 0.8,
    }));

    // Blog articles
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
    } catch { /* model unavailable */ }

    // Products
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
    } catch { /* model unavailable */ }

    // Forum topics
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
    } catch { /* model unavailable */ }

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
