import {
    RATE_LIMIT_AUTH,
    RATE_LIMIT_API,
    RATE_LIMIT_UPLOAD,
} from "./constants";
import { getRedisClient, isRedisConfigured } from "./redis";
import { prisma } from "./db";

/**
 * Rate limiter with a pluggable backend. When REDIS_URL is set the
 * RedisBackend is used so counts are shared across PM2 workers and
 * serverless lambdas; otherwise MemoryBackend keeps the legacy
 * in-process behavior. Both implementations conform to the
 * RateLimitBackend interface below so new backends (e.g. Memcached,
 * Cloudflare KV) can be added without touching callers.
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

// ---------------------------------------------------------------------------
// Memory backend — process-local Map. Always available, used as fallback.
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
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

// ---------------------------------------------------------------------------
// Redis backend — shared across processes via SET PX + read-modify-write.
// On any Redis error we transparently fall back to the memory backend so a
// flaky Redis can never take down request handling.
// ---------------------------------------------------------------------------

export const RedisBackend: RateLimitBackend = {
    name: "redis",
    async hit(identifier, config) {
        const redis = await getRedisClient();
        if (!redis) return memoryHitSync(identifier, config);

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
            return memoryHitSync(identifier, config);
        }
    },
};

/**
 * Select the active backend once at module load. Consumers should not
 * import the backends directly — use rateLimit() or rateLimitForRole().
 */
const activeBackend: RateLimitBackend = isRedisConfigured() ? RedisBackend : MemoryBackend;

/**
 * Health check helper — returns true if Redis is configured AND currently
 * reachable. Safe to call from admin endpoints / ops dashboards.
 */
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

/**
 * Primary async rate limiter. Uses the selected backend (Redis or memory).
 */
export async function rateLimit(
    identifier: string,
    config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }
): Promise<RateLimitResult> {
    return activeBackend.hit(identifier, config);
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
): Promise<RateLimitResult> {
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
