// Loading + normalising the marketplace index, shared by the two routes that
// serve it: the admin-facing /api/v1/modules/marketplace and the first-run
// /api/setup/modules. Kept in a non-route file so Next.js only sees valid HTTP
// exports from each route.ts.

import fs from "fs/promises";
import path from "path";
import type { MarketplaceIndex, MarketplaceModule } from "./_types";
import {
    MARKETPLACE_CACHE_TTL_MS,
    getCachedMarketplace,
    setCachedMarketplace,
} from "./_cache";
import { moduleMarketplaceIndexUrl } from "@/core/lib/marketplace-source";

const LOCAL_INDEX_PATH = path.join(process.cwd(), "module-marketplace", "index.json");

async function loadBaseIndex(): Promise<MarketplaceIndex> {
    // Prefer the local index.json (rebuilt by scripts/build-marketplace.sh);
    // fall back to the GitHub copy when running in a stripped dev checkout.
    try {
        const raw = await fs.readFile(LOCAL_INDEX_PATH, "utf-8");
        return JSON.parse(raw) as MarketplaceIndex;
    } catch {
        const res = await fetch(moduleMarketplaceIndexUrl(), { next: { revalidate: 300 } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as MarketplaceIndex;
    }
}

function ensureDefaults(
    m: Partial<MarketplaceModule> & { id: string; name: string; version: string },
): MarketplaceModule {
    return {
        id: m.id,
        name: m.name,
        description: m.description ?? "",
        version: m.version,
        author: m.author ?? "uxwVend",
        icon: m.icon ?? "Package",
        category: m.category ?? "content",
        verified: m.verified ?? true,
        updatedAt: m.updatedAt ?? new Date().toISOString(),
        screenshots: m.screenshots ?? [],
        tags: m.tags ?? [m.category ?? "uncategorized"],
        zip: m.zip ?? `${m.id}.zip`,
        dependencies: m.dependencies ?? [],
        conflicts: m.conflicts ?? [],
        coreVersion: m.coreVersion ?? null,
        stats: m.stats ?? { publicRoutes: 0, adminRoutes: 0, apiRoutes: 0, widgets: 0 },
    };
}

/**
 * The normalised catalog, memoised for MARKETPLACE_CACHE_TTL_MS.
 *
 * Returns the last good copy when a refresh fails, and throws only when there
 * is nothing cached to fall back to. Callers decide what an empty catalog
 * means for their surface.
 */
export async function loadMarketplaceCatalog(): Promise<MarketplaceIndex> {
    const cache = getCachedMarketplace();
    if (cache.index && Date.now() - cache.time < MARKETPLACE_CACHE_TTL_MS) {
        return cache.index;
    }

    try {
        const base = await loadBaseIndex();
        const normalized: MarketplaceIndex = {
            ...base,
            modules: base.modules.map((m) => ensureDefaults(m)),
        };
        setCachedMarketplace(normalized);
        return normalized;
    } catch (err) {
        if (cache.index) return cache.index;
        throw err;
    }
}
