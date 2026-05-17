import type { SitemapEntry } from "@/core/generated/module-seo";

export default async function trophiesSitemap(): Promise<SitemapEntry[]> {
    return [
        {
            url: "/trophies",
            lastModified: new Date(),
            changeFreq: "weekly" as const,
            priority: 0.5,
        },
    ];
}
