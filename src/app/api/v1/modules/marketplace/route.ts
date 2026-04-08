import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/core/lib/db";
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
        downloads: m.downloads ?? 0,
        rating: m.rating ?? null,
        ratingCount: m.ratingCount ?? 0,
        updatedAt: m.updatedAt ?? new Date().toISOString(),
        screenshots: m.screenshots ?? [],
        tags: m.tags ?? [m.category ?? "uncategorized"],
        zip: m.zip ?? `${m.id}.zip`,
        dependencies: m.dependencies ?? [],
        stats: m.stats ?? { publicRoutes: 0, adminRoutes: 0, apiRoutes: 0, widgets: 0 },
    };
}

async function overlayRuntimeStats(index: MarketplaceIndex): Promise<MarketplaceIndex> {
    // Cumulative installs per module (writes go through marketplace/install).
    const installCounts = await prisma.moduleInstallEvent.groupBy({
        by: ["moduleId"],
        _count: { _all: true },
    });
    const installMap = new Map<string, number>();
    for (const row of installCounts) installMap.set(row.moduleId, row._count._all);

    // Average rating + count.
    const ratingAgg = await prisma.moduleRating.groupBy({
        by: ["moduleId"],
        _avg: { rating: true },
        _count: { _all: true },
    });
    const ratingMap = new Map<string, { avg: number | null; count: number }>();
    for (const row of ratingAgg) {
        ratingMap.set(row.moduleId, {
            avg: row._avg.rating !== null ? Number(row._avg.rating) : null,
            count: row._count._all,
        });
    }

    const merged = index.modules.map((raw) => {
        const m = ensureDefaults(raw);
        const extraInstalls = installMap.get(m.id) ?? 0;
        const rating = ratingMap.get(m.id);
        return {
            ...m,
            downloads: m.downloads + extraInstalls,
            rating: rating
                ? rating.avg !== null
                    ? Math.round(rating.avg * 10) / 10
                    : m.rating
                : m.rating,
            ratingCount: rating ? rating.count : m.ratingCount,
        };
    });

    return { ...index, modules: merged };
}

// GET /api/v1/modules/marketplace — list modules with live runtime stats
export async function GET() {
    const cache = getCachedMarketplace();
    if (cache.index && Date.now() - cache.time < MARKETPLACE_CACHE_TTL_MS) {
        return NextResponse.json(cache.index);
    }

    try {
        const base = await loadBaseIndex();
        const enriched = await overlayRuntimeStats(base);
        setCachedMarketplace(enriched);
        return NextResponse.json(enriched);
    } catch {
        if (cache.index) return NextResponse.json(cache.index);
        return NextResponse.json(
            { modules: [], error: "Failed to fetch marketplace" },
            { status: 502 },
        );
    }
}
