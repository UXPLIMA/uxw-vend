import type { MetadataRoute } from "next";
import { getModuleStates } from "@/core/lib/module-cache";
import { ModuleSeoRoutes, type SitemapEntry } from "@/core/generated/module-seo";
import { safeCall } from "@/core/lib/module-safe-call";
import { connection } from "next/server";
import { resolveAppUrl } from "@/core/lib/app-url";

// This used to be `export const revalidate = 3600`, which made Next prerender
// the sitemap at BUILD time and serve that copy for the first hour. In a
// prebuilt image that meant every URL in it read `http://localhost:3001` - the
// value CI had while building. `connection()` in the handler below opts the
// route out of build-time prerendering; this in-process memo restores exactly
// what `revalidate` was protecting: bots hitting /sitemap.xml still do not
// force a DB query per request.
const SITEMAP_TTL_MS = 3_600_000;
let sitemapMemo: { at: number; siteUrl: string; entries: MetadataRoute.Sitemap } | null = null;

interface CoreStaticRoute {
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
    priority: number;
}

// Static routes that always exist in core - no module involvement.
const CORE_STATIC_ROUTES: CoreStaticRoute[] = [
    { path: "/", changeFrequency: "daily", priority: 1.0 },
    { path: "/activity", changeFrequency: "daily", priority: 0.6 },
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
    await connection();

    // Runtime-resolved from AUTH_URL - a NEXT_PUBLIC_* read here would be
    // frozen at build time and emit localhost URLs from the prebuilt image.
    const siteUrl = resolveAppUrl();

    // Keyed on siteUrl as well as age: an operator who changes AUTH_URL and
    // restarts must not be served an hour of stale, wrong-host URLs.
    if (
        sitemapMemo &&
        sitemapMemo.siteUrl === siteUrl &&
        Date.now() - sitemapMemo.at < SITEMAP_TTL_MS
    ) {
        return sitemapMemo.entries;
    }
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

        // Wrap each loader + handler in the sandbox so a broken module
        // can't break the sitemap for the whole site. Runtime errors get
        // logged to ActivityLog for admin visibility.
        const moduleEntries = await safeCall<SitemapEntry[]>(
            seoRoute.module,
            "seo.sitemap",
            async () => {
                const mod = await seoRoute.loader();
                const handler = mod.default;
                if (typeof handler !== "function") return [];
                const result = await handler();
                return Array.isArray(result) ? result : [];
            },
            [],
        );

        for (const e of moduleEntries) {
            entries.push({
                url: e.url.startsWith("http") ? e.url : `${siteUrl}${e.url.startsWith("/") ? "" : "/"}${e.url}`,
                ...(e.lastModified ? { lastModified: e.lastModified } : {}),
                ...(e.changeFreq ? { changeFrequency: mapChangeFreq(e.changeFreq) } : {}),
                ...(typeof e.priority === "number" ? { priority: e.priority } : {}),
            });
        }
    }

    sitemapMemo = { at: Date.now(), siteUrl, entries };
    return entries;
}
