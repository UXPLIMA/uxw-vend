// Helpers that mutate the on-disk marketplace index.json so runtime
// counters (downloads, rating aggregates) survive process restarts.
// Invoked by the install + rate routes. Non-fatal on failure.

import fs from "fs/promises";
import path from "path";
import type { MarketplaceIndex } from "./_types";
import { invalidateMarketplaceCache } from "./_cache";

const LOCAL_INDEX_PATH = path.join(process.cwd(), "module-marketplace", "index.json");

async function readIndex(): Promise<MarketplaceIndex | null> {
    try {
        const raw = await fs.readFile(LOCAL_INDEX_PATH, "utf-8");
        return JSON.parse(raw) as MarketplaceIndex;
    } catch {
        return null;
    }
}

async function writeIndex(index: MarketplaceIndex): Promise<void> {
    await fs.writeFile(LOCAL_INDEX_PATH, JSON.stringify(index, null, 2));
    invalidateMarketplaceCache();
}

export async function incrementIndexDownloads(moduleId: string): Promise<void> {
    const index = await readIndex();
    if (!index) return;
    const mod = index.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    mod.downloads = (mod.downloads ?? 0) + 1;
    await writeIndex(index);
}

export async function updateIndexRating(
    moduleId: string,
    average: number | null,
    count: number,
): Promise<void> {
    const index = await readIndex();
    if (!index) return;
    const mod = index.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    mod.rating = average !== null ? Math.round(average * 10) / 10 : null;
    mod.ratingCount = count;
    await writeIndex(index);
}
