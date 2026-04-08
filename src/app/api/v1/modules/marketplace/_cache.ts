// Shared in-memory cache state for the marketplace index route.
// Kept in a non-route file so Next.js only sees valid HTTP exports from the
// route.ts itself.

import type { MarketplaceIndex } from "./_types";

const state: { index: MarketplaceIndex | null; time: number } = {
    index: null,
    time: 0,
};

export const MARKETPLACE_CACHE_TTL_MS = 5 * 60 * 1000;

export function getCachedMarketplace(): { index: MarketplaceIndex | null; time: number } {
    return state;
}

export function setCachedMarketplace(index: MarketplaceIndex) {
    state.index = index;
    state.time = Date.now();
}

export function invalidateMarketplaceCache() {
    state.index = null;
    state.time = 0;
}
