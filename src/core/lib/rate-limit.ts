import {
    RATE_LIMIT_AUTH,
    RATE_LIMIT_API,
    RATE_LIMIT_CHECKOUT,
    RATE_LIMIT_UPLOAD,
} from "./constants";
import { getRedisClient, isRedisConfigured } from "./redis";

/**
 * Rate limiter with automatic Redis/in-memory fallback.
 * Uses shared Redis client from redis.ts when REDIS_URL is set.
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store (fallback)
const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (in-memory only)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
        if (entry.resetAt < now) memoryStore.delete(key);
    }
}, 60000);

async function redisRateLimit(
    identifier: string,
    config: RateLimitConfig
): Promise<{ success: boolean; remaining: number; resetAt: number } | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    try {
        const key = `rl:${identifier}`;
        const now = Date.now();

        const stored = await redis.get(key);
        if (stored) {
            const entry: RateLimitEntry = JSON.parse(stored);
            if (entry.resetAt < now) {
                const newEntry: RateLimitEntry = { count: 1, resetAt: now + config.windowMs };
                await redis.set(key, JSON.stringify(newEntry), { PX: config.windowMs });
                return { success: true, remaining: config.maxRequests - 1, resetAt: newEntry.resetAt };
            }

            entry.count++;
            const ttl = entry.resetAt - now;
            await redis.set(key, JSON.stringify(entry), { PX: Math.max(ttl, 1) });

            if (entry.count > config.maxRequests) {
                return { success: false, remaining: 0, resetAt: entry.resetAt };
            }
            return { success: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
        }

        const newEntry: RateLimitEntry = { count: 1, resetAt: now + config.windowMs };
        await redis.set(key, JSON.stringify(newEntry), { PX: config.windowMs });
        return { success: true, remaining: config.maxRequests - 1, resetAt: newEntry.resetAt };
    } catch {
        return null;
    }
}

function memoryRateLimit(
    identifier: string,
    config: RateLimitConfig
): { success: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = memoryStore.get(identifier);

    if (!entry || entry.resetAt < now) {
        memoryStore.set(identifier, { count: 1, resetAt: now + config.windowMs });
        return { success: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
        return { success: false, remaining: 0, resetAt: entry.resetAt };
    }

    return { success: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

export async function rateLimit(
    identifier: string,
    config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
    if (isRedisConfigured()) {
        const result = await redisRateLimit(identifier, config);
        if (result) return result;
    }

    return memoryRateLimit(identifier, config);
}

/**
 * Helper to get client IP from request headers
 */
export function getClientIP(headers: Headers): string {
    return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || headers.get("x-real-ip")
        || "unknown";
}

/**
 * Preset rate limit configs
 */
export const rateLimits = {
    auth: RATE_LIMIT_AUTH,
    api: RATE_LIMIT_API,
    checkout: RATE_LIMIT_CHECKOUT,
    upload: RATE_LIMIT_UPLOAD,
};
