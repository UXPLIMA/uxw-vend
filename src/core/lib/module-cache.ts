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
    // Try cache first
    const cached = await cacheGetJSON<Record<string, boolean>>(CACHE_KEY);
    if (cached) return cached;

    // Cache miss — query DB
    const configs = await prisma.moduleConfig.findMany({ select: { id: true, enabled: true } });
    const states: Record<string, boolean> = {};
    for (const c of configs) states[c.id] = c.enabled;

    // Store in cache
    await cacheSetJSON(CACHE_KEY, states, CACHE_TTL);

    return states;
}

/** Invalidate module states cache (call after enable/disable/install/uninstall) */
export async function invalidateModuleCache(): Promise<void> {
    await cacheDel(CACHE_KEY);
}
