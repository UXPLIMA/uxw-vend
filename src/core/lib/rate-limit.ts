/**
 * In-memory rate limiter
 * For production, replace with Redis-based limiter
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.resetAt < now) store.delete(key);
    }
}, 60000);

export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

export function rateLimit(
    identifier: string,
    config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }
): { success: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = store.get(identifier);

    if (!entry || entry.resetAt < now) {
        store.set(identifier, { count: 1, resetAt: now + config.windowMs });
        return { success: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
        return { success: false, remaining: 0, resetAt: entry.resetAt };
    }

    return { success: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
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
    auth: { maxRequests: 10, windowMs: 60000 },       // 10 per minute
    api: { maxRequests: 120, windowMs: 60000 },        // 120 per minute
    checkout: { maxRequests: 5, windowMs: 60000 },     // 5 per minute
    upload: { maxRequests: 3, windowMs: 60000 },       // 3 per minute
    vote: { maxRequests: 10, windowMs: 60000 },        // 10 per minute
    spin: { maxRequests: 2, windowMs: 60000 },         // 2 per minute
};
