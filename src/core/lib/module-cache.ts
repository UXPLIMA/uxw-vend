/**
 * Module config cache — uses Redis when available, in-memory fallback.
 * Called from API routes and server components (NOT proxy/middleware).
 */

import { prisma } from "./db";
import { cacheGetJSON, cacheSetJSON, cacheDel } from "./redis";

const CACHE_KEY = "uxw:modules:status";
const CACHE_TTL = 30; // seconds

/** Get all module enabled/disabled states (cached) */
export async function getModuleStates(): Promise<Record<string, boolean>> {
    const cached = await cacheGetJSON<Record<string, boolean>>(CACHE_KEY);
    if (cached) return cached;

    // Cache miss — query DB. Must fail soft: this helper is called from
    // the proxy middleware on every request, from module-provider during
    // SSR, and (crucially) during `next build`'s static-collection phase
    // where DATABASE_URL may not be reachable at all. Treat an unavailable
    // DB as "no explicit states known" — consumers default to enabled.
    let configs: Array<{ id: string; enabled: boolean }> = [];
    try {
        configs = await prisma.moduleConfig.findMany({ select: { id: true, enabled: true } });
    } catch (err) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[module-cache] moduleConfig.findMany failed (returning empty):", err);
        }
        return {};
    }

    const states: Record<string, boolean> = {};
    for (const c of configs) states[c.id] = c.enabled;
    await cacheSetJSON(CACHE_KEY, states, CACHE_TTL);
    return states;
}

/** Invalidate module states cache (call after enable/disable/install/uninstall) */
export async function invalidateModuleCache(): Promise<void> {
    await cacheDel(CACHE_KEY);
}
