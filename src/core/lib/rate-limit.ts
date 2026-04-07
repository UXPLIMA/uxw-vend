import {
    RATE_LIMIT_AUTH,
    RATE_LIMIT_API,
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
 * Trusted proxy IPs for x-forwarded-for validation.
 * Set TRUSTED_PROXY_IPS env var as comma-separated IPs to restrict
 * which proxies are trusted to set forwarded headers.
 */
const TRUSTED_PROXY_IPS: Set<string> | null = process.env.TRUSTED_PROXY_IPS
    ? new Set(process.env.TRUSTED_PROXY_IPS.split(",").map(ip => ip.trim()))
    : null;

/**
 * Helper to get client IP from request headers.
 * Priority: x-real-ip > x-forwarded-for (first value) > "unknown"
 *
 * When TRUSTED_PROXY_IPS is configured, forwarded headers are only
 * trusted if the direct connection IP (from x-real-ip or socket) is
 * in the trusted set. This prevents IP spoofing via header injection.
 */
export function getClientIP(headers: Headers): string {
    const realIp = headers.get("x-real-ip")?.trim() || null;
    const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    // If trusted proxies are configured, only trust forwarded headers
    // when the direct connection comes from a trusted proxy
    if (TRUSTED_PROXY_IPS) {
        // x-real-ip is typically set by the reverse proxy to the actual client IP
        // If the proxy itself is trusted, we can use x-forwarded-for
        const directIp = realIp || "unknown";
        if (TRUSTED_PROXY_IPS.has(directIp)) {
            return forwardedFor || directIp;
        }
        // Proxy not trusted — use direct connection IP, ignoring forwarded headers
        return directIp;
    }

    // No trusted proxy list configured — use headers as-is (current behavior)
    return realIp || forwardedFor || "unknown";
}

/**
 * Preset rate limit configs
 */
export const rateLimits = {
    auth: RATE_LIMIT_AUTH,
    api: RATE_LIMIT_API,
    upload: RATE_LIMIT_UPLOAD,
};
