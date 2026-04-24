import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { MarketplaceIndex, MarketplaceModule } from "./_types";
import {
    MARKETPLACE_CACHE_TTL_MS,
    getCachedMarketplace,
    setCachedMarketplace,
} from "./_cache";

const MARKETPLACE_URL =
    "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace/index.json";
const LOCAL_INDEX_PATH = path.join(process.cwd(), "module-marketplace", "index.json");

async function loadBaseIndex(): Promise<MarketplaceIndex> {
    // Prefer the local index.json (rebuilt by scripts/build-marketplace.sh);
    // fall back to the GitHub copy when running in a stripped dev checkout.
    try {
        const raw = await fs.readFile(LOCAL_INDEX_PATH, "utf-8");
        return JSON.parse(raw) as MarketplaceIndex;
    } catch {
        const res = await fetch(MARKETPLACE_URL, { next: { revalidate: 300 } });
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
        stats: m.stats ?? { publicRoutes: 0, adminRoutes: 0, apiRoutes: 0, widgets: 0 },
    };
}

// GET /api/v1/modules/marketplace — list modules from the local index
export async function GET() {
    const cache = getCachedMarketplace();
    if (cache.index && Date.now() - cache.time < MARKETPLACE_CACHE_TTL_MS) {
        return NextResponse.json(cache.index);
    }

    try {
        const base = await loadBaseIndex();
        const normalized: MarketplaceIndex = {
            ...base,
            modules: base.modules.map((m) => ensureDefaults(m)),
        };
        setCachedMarketplace(normalized);
        return NextResponse.json(normalized);
    } catch {
        if (cache.index) return NextResponse.json(cache.index);
        return NextResponse.json(
            { modules: [], error: "Failed to fetch marketplace" },
            { status: 502 },
        );
    }
}
