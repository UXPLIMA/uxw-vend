import {
    RATE_LIMIT_AUTH,
    RATE_LIMIT_API,
    RATE_LIMIT_CHECKOUT,
    RATE_LIMIT_UPLOAD,
    RATE_LIMIT_VOTE,
    RATE_LIMIT_SPIN,
} from "./constants";

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
    auth: RATE_LIMIT_AUTH,
    api: RATE_LIMIT_API,
    checkout: RATE_LIMIT_CHECKOUT,
    upload: RATE_LIMIT_UPLOAD,
    vote: RATE_LIMIT_VOTE,
    spin: RATE_LIMIT_SPIN,
};
