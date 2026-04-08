import {
    RATE_LIMIT_AUTH,
    RATE_LIMIT_API,
    RATE_LIMIT_UPLOAD,
} from "./constants";
import { getRedisClient, isRedisConfigured } from "./redis";
import { prisma } from "./db";

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

/* ---------------------------------------------------------------------------
 * Per-role rate limit multipliers
 * ---------------------------------------------------------------------------
 * Multipliers are stored in Setting key "rate_limit_role_multipliers" as a
 * JSON object mapping role name -> number, e.g.
 *   { "admin": 0, "moderator": 5, "member": 1 }
 *
 * Semantics:
 *   0        = unlimited (rate limit is skipped entirely)
 *   1        = base limit (default if a role has no entry or no setting row
 *              exists at all)
 *   > 1      = lift the limit by that multiplier (e.g. 5 = 5x base)
 *   0..<100  = accepted range (validated on write)
 *
 * The loaded multipliers are cached in-memory for 60 seconds per process to
 * avoid a DB hit on every rate-limited request. Call
 * `invalidateRoleMultiplierCache()` after updating the setting to force a
 * refresh on the next read.
 *
 * Usage example:
 *
 *   import { auth } from "@/core/lib/auth";
 *   import { rateLimitForRole, rateLimits, getClientIP } from "@/core/lib/rate-limit";
 *
 *   export async function POST(req: NextRequest) {
 *     const session = await auth();
 *     const role = session?.user?.role;
 *     const id = session?.user?.id ?? getClientIP(req.headers);
 *     const rl = await rateLimitForRole(`myapi:${id}`, rateLimits.api, role);
 *     if (!rl.success) return new Response("Too Many Requests", { status: 429 });
 *     // ...handle request
 *   }
 * ------------------------------------------------------------------------- */

export const ROLE_MULTIPLIER_SETTING_KEY = "rate_limit_role_multipliers";
const ROLE_MULTIPLIER_CACHE_TTL_MS = 60_000;

let roleMultiplierCache: Map<string, number> | null = null;
let roleMultiplierCacheExpiresAt = 0;

/**
 * Invalidate the in-memory role multiplier cache. Call this after the
 * admin updates the setting so that the next request reloads from DB.
 */
export function invalidateRoleMultiplierCache(): void {
    roleMultiplierCache = null;
    roleMultiplierCacheExpiresAt = 0;
}

/**
 * Load role multipliers from the Setting table, using a 60s in-memory cache.
 * Returns an empty Map on any error so callers fall back to the default (1).
 */
export async function getRoleMultipliers(): Promise<Map<string, number>> {
    const now = Date.now();
    if (roleMultiplierCache && roleMultiplierCacheExpiresAt > now) {
        return roleMultiplierCache;
    }

    const fresh = new Map<string, number>();
    try {
        const row = await prisma.setting.findUnique({
            where: { key: ROLE_MULTIPLIER_SETTING_KEY },
        });
        if (row && row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
            for (const [role, raw] of Object.entries(row.value as Record<string, unknown>)) {
                const num = typeof raw === "number" ? raw : Number(raw);
                if (Number.isFinite(num) && num >= 0 && num <= 100) {
                    fresh.set(role, num);
                }
            }
        }
    } catch {
        // Silent fail — return whatever we built (possibly empty).
        // Callers treat "missing" as multiplier=1.
    }

    roleMultiplierCache = fresh;
    roleMultiplierCacheExpiresAt = now + ROLE_MULTIPLIER_CACHE_TTL_MS;
    return fresh;
}

/**
 * Role-aware wrapper around {@link rateLimit}.
 *
 * - If the role has multiplier `0`, the request is treated as unlimited:
 *   returns `{ success: true, remaining: Infinity, resetAt: 0 }`.
 * - Otherwise the base `maxRequests` is multiplied by the role multiplier
 *   (default 1 when no role is provided or the role has no entry).
 *
 * This function never throws — any DB/cache error falls back to the default
 * multiplier of 1 so the base rate limit still applies.
 */
export async function rateLimitForRole(
    identifier: string,
    baseConfig: RateLimitConfig,
    role?: string | null
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
    let multiplier = 1;
    if (role) {
        const map = await getRoleMultipliers();
        const entry = map.get(role);
        if (typeof entry === "number") multiplier = entry;
    }

    if (multiplier === 0) {
        return { success: true, remaining: Number.POSITIVE_INFINITY, resetAt: 0 };
    }

    const effectiveMax = Math.max(1, Math.floor(baseConfig.maxRequests * multiplier));
    return rateLimit(identifier, {
        maxRequests: effectiveMax,
        windowMs: baseConfig.windowMs,
    });
}
