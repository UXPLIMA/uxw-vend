import {
    RATE_LIMIT_AUTH,
    RATE_LIMIT_API,
    RATE_LIMIT_UPLOAD,
} from "./constants";
import { getRedisClient, isRedisConfigured } from "./redis";
import { prisma } from "./db";

/**
 * Pluggable rate limiter. Uses Redis when REDIS_URL is set so counts are
 * shared across PM2 workers; otherwise falls back to an in-process Map.
 *
 * Public API:
 *   rateLimit                   — low-level hit against the active backend
 *   rateLimitForRole            — applies per-role multiplier; returns full result
 *   rateLimitForRoleAsync       — boolean-returning variant; transparently
 *                                 falls back to memory on transient Redis failure
 */

export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetAt: number;
}

export interface RateLimitBackend {
    readonly name: string;
    hit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult>;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// ===== Memory backend (process-local fallback) =====

const memoryStore = new Map<string, RateLimitEntry>();

setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
        if (entry.resetAt < now) memoryStore.delete(key);
    }
}, 60000);

function memoryHitSync(identifier: string, config: RateLimitConfig): RateLimitResult {
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

export const MemoryBackend: RateLimitBackend = {
    name: "memory",
    async hit(identifier, config) {
        return memoryHitSync(identifier, config);
    },
};

// ===== Redis backend (shared across processes) =====
// Any error falls through to the memory backend so a flaky Redis cannot
// take down request handling.

let lastRedisFallbackWarnAt = 0;
function warnRedisFallback(reason: string): void {
    const now = Date.now();
    if (now - lastRedisFallbackWarnAt < 30_000) return;
    lastRedisFallbackWarnAt = now;
    console.error(`[rate-limit] Redis unavailable (${reason}) — serving requests with in-memory fallback. Counts are NOT shared across workers.`);
}

export const RedisBackend: RateLimitBackend = {
    name: "redis",
    async hit(identifier, config) {
        const redis = await getRedisClient();
        if (!redis) {
            warnRedisFallback("client not connected");
            return memoryHitSync(identifier, config);
        }

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
        } catch (err) {
            warnRedisFallback(err instanceof Error ? err.message : "unknown error");
            return memoryHitSync(identifier, config);
        }
    },
};

/**
 * Pick the backend on first use (not at module load) so `next build` can
 * compile when REDIS_URL is only present at runtime.
 *
 * Production requires Redis: the memory backend is process-local and breaks
 * under multi-worker deployments, making limits trivially bypassable. Without
 * Redis we deny requests instead of silently falling back. Set
 * ALLOW_MEMORY_RATE_LIMIT=1 to opt in on a true single-worker prod setup.
 */
let cachedBackend: RateLimitBackend | null = null;
let prodMisconfigLoggedAt = 0;

function getActiveBackend(): RateLimitBackend {
    if (cachedBackend) return cachedBackend;

    if (isRedisConfigured()) {
        cachedBackend = RedisBackend;
        return cachedBackend;
    }

    const isProd = process.env.NODE_ENV === "production";
    const override = process.env.ALLOW_MEMORY_RATE_LIMIT === "1";
    if (isProd && !override) {
        const now = Date.now();
        if (now - prodMisconfigLoggedAt > 60_000) {
            prodMisconfigLoggedAt = now;
            console.error(
                "[rate-limit] REDIS_URL is required in production. " +
                "The in-memory backend does not share state across workers and is bypassable. " +
                "Set REDIS_URL, or ALLOW_MEMORY_RATE_LIMIT=1 to opt out (single-worker only). " +
                "Requests are being denied until Redis is configured.",
            );
        }
        // Not cached: re-evaluate on every call so a freshly-set REDIS_URL
        // is picked up without a restart.
        return DenyAllBackend;
    }

    cachedBackend = MemoryBackend;
    return cachedBackend;
}

const DenyAllBackend: RateLimitBackend = {
    name: "deny-all",
    async hit(_identifier, _config) {
        return { success: false, remaining: 0, resetAt: Date.now() + 60_000 };
    },
};

/** True when REDIS_URL is set and the client is currently reachable. */
export async function isRedisReady(): Promise<boolean> {
    if (!isRedisConfigured()) return false;
    try {
        const redis = await getRedisClient();
        if (!redis) return false;
        await redis.ping();
        return true;
    } catch {
        return false;
    }
}

export async function rateLimit(
    identifier: string,
    config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }
): Promise<RateLimitResult> {
    return getActiveBackend().hit(identifier, config);
}

// Comma-separated direct-peer IPs that may set forwarded headers.
// Without this set, anything goes — set TRUSTED_PROXY_IPS in production.
const TRUSTED_PROXY_IPS: Set<string> | null = process.env.TRUSTED_PROXY_IPS
    ? new Set(process.env.TRUSTED_PROXY_IPS.split(",").map(ip => ip.trim()))
    : null;

/**
 * Resolve the real client IP from request headers.
 *
 * When TRUSTED_PROXY_IPS is set, `x-forwarded-for` is only honored if the
 * direct peer (x-real-ip) is in the trusted list — this blocks header
 * injection spoofing from unauthorised origins.
 */
export function getClientIP(headers: Headers): string {
    const realIp = headers.get("x-real-ip")?.trim() || null;
    const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    if (TRUSTED_PROXY_IPS) {
        const directIp = realIp || "unknown";
        if (TRUSTED_PROXY_IPS.has(directIp)) {
            return forwardedFor || directIp;
        }
        return directIp;
    }

    return realIp || forwardedFor || "unknown";
}

export const rateLimits = {
    auth: RATE_LIMIT_AUTH,
    api: RATE_LIMIT_API,
    upload: RATE_LIMIT_UPLOAD,
};

// ===== Per-role multipliers =====
// Stored in Setting "rate_limit_role_multipliers" as { role: number }.
//   0       — unlimited (skip rate limit entirely)
//   1       — base limit (default when no entry exists)
//   >1      — multiply base limit (e.g. 5 = 5x more requests allowed)
//   0..100  — accepted range, validated on write
// Cached in-process for 60s; call invalidateRoleMultiplierCache after edits.

export const ROLE_MULTIPLIER_SETTING_KEY = "rate_limit_role_multipliers";
const ROLE_MULTIPLIER_CACHE_TTL_MS = 60_000;

let roleMultiplierCache: Map<string, number> | null = null;
let roleMultiplierCacheExpiresAt = 0;

/** Drop the cache so the next request reloads multipliers from DB. */
export function invalidateRoleMultiplierCache(): void {
    roleMultiplierCache = null;
    roleMultiplierCacheExpiresAt = 0;
}

/** Returns an empty Map on error so callers fall back to multiplier=1. */
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
        // Silent fail; callers treat a missing entry as multiplier=1.
    }

    roleMultiplierCache = fresh;
    roleMultiplierCacheExpiresAt = now + ROLE_MULTIPLIER_CACHE_TTL_MS;
    return fresh;
}

async function resolveRoleMultiplier(role?: string | null): Promise<number> {
    if (!role) return 1;
    try {
        const map = await getRoleMultipliers();
        const entry = map.get(role);
        return typeof entry === "number" ? entry : 1;
    } catch {
        return 1;
    }
}

/** Returns null when the multiplier is 0 (unlimited) so callers short-circuit. */
function applyMultiplier(
    baseConfig: RateLimitConfig,
    multiplier: number
): RateLimitConfig | null {
    if (multiplier === 0) return null;
    return {
        maxRequests: Math.max(1, Math.floor(baseConfig.maxRequests * multiplier)),
        windowMs: baseConfig.windowMs,
    };
}

/**
 * Role-aware wrapper. Multiplier 0 returns unlimited; otherwise scales
 * maxRequests. DB errors fall back to multiplier=1 (base limit).
 */
export async function rateLimitForRole(
    identifier: string,
    baseConfig: RateLimitConfig,
    role?: string | null
): Promise<RateLimitResult> {
    const multiplier = await resolveRoleMultiplier(role);
    const effective = applyMultiplier(baseConfig, multiplier);
    if (effective === null) {
        return { success: true, remaining: Number.POSITIVE_INFINITY, resetAt: 0 };
    }
    return rateLimit(identifier, effective);
}

/**
 * Boolean-returning rate limiter that probes Redis readiness per call so
 * long-running processes recover from transient Redis outages without a
 * restart. Use this when only the allow/deny bit matters.
 */
export async function rateLimitForRoleAsync(
    identifier: string,
    baseConfig: RateLimitConfig,
    role?: string | null
): Promise<boolean> {
    const multiplier = await resolveRoleMultiplier(role);
    const effective = applyMultiplier(baseConfig, multiplier);
    if (effective === null) return true;

    // Probe Redis readiness per call when configured; without REDIS_URL we
    // route through getActiveBackend so the production misconfig guard fires
    // instead of silently using memory.
    const backend: RateLimitBackend = isRedisConfigured()
        ? ((await isRedisReady()) ? RedisBackend : MemoryBackend)
        : getActiveBackend();

    try {
        const result = await backend.hit(identifier, effective);
        return result.success;
    } catch {
        const result = await MemoryBackend.hit(identifier, effective);
        return result.success;
    }
}
