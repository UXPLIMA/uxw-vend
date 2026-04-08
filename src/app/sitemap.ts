import type { MetadataRoute } from "next";
import { getModuleStates } from "@/core/lib/module-cache";
import { ModuleSeoRoutes, type SitemapEntry } from "@/core/generated/module-seo";

// Revalidate sitemap every hour so bots hitting /sitemap.xml don't force
// a DB query per request but newly published content still surfaces quickly.
export const revalidate = 3600;

interface CoreStaticRoute {
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
    priority: number;
}

// Static routes that always exist in core — no module involvement.
const CORE_STATIC_ROUTES: CoreStaticRoute[] = [
    { path: "/", changeFrequency: "daily", priority: 1.0 },
    { path: "/activity", changeFrequency: "daily", priority: 0.6 },
    { path: "/trophies", changeFrequency: "weekly", priority: 0.5 },
    { path: "/auth/login", changeFrequency: "yearly", priority: 0.3 },
    { path: "/auth/register", changeFrequency: "yearly", priority: 0.3 },
];

function mapChangeFreq(freq: SitemapEntry["changeFreq"]): MetadataRoute.Sitemap[number]["changeFrequency"] {
    return freq;
}

/**
 * Dynamic sitemap: merges core static routes with every installed+enabled
 * module's SEO contributor. Each module loader is wrapped in try/catch so
 * one broken module cannot break the whole sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
    const now = new Date();

    const entries: MetadataRoute.Sitemap = CORE_STATIC_ROUTES.map((r) => ({
        url: `${siteUrl}${r.path}`,
        lastModified: now,
        changeFrequency: r.changeFrequency,
        priority: r.priority,
    }));

    // Only modules that are actually enabled contribute URLs. Keeps the
    // sitemap aligned with what's actually routable on the site.
    let enabledStates: Record<string, boolean> = {};
    try {
        enabledStates = await getModuleStates();
    } catch {
        enabledStates = {};
    }

    for (const seoRoute of ModuleSeoRoutes) {
        if (!enabledStates[seoRoute.module]) continue;

        try {
            const mod = await seoRoute.loader();
            const handler = mod.default;
            if (typeof handler !== "function") continue;
            const moduleEntries = await handler();
            for (const e of moduleEntries) {
                entries.push({
                    url: e.url.startsWith("http") ? e.url : `${siteUrl}${e.url.startsWith("/") ? "" : "/"}${e.url}`,
                    ...(e.lastModified ? { lastModified: e.lastModified } : {}),
                    ...(e.changeFreq ? { changeFrequency: mapChangeFreq(e.changeFreq) } : {}),
                    ...(typeof e.priority === "number" ? { priority: e.priority } : {}),
                });
            }
        } catch (err) {
            // Swallow per-module errors so the rest of the sitemap still renders.
            console.error(`[sitemap] module "${seoRoute.module}" failed:`, err);
        }
    }

    return entries;
}
