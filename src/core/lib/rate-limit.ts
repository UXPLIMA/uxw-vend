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
 *
 * Public API:
 *   - rateLimit(identifier, config)
 *       Low-level hit against the module-load-time selected backend.
 *   - rateLimitForRole(identifier, config, role?)
 *       Role-multiplier-aware wrapper. Returns a full RateLimitResult.
 *       Used by all 16+ existing call sites — DO NOT break.
 *   - rateLimitForRoleAsync(identifier, config, role?)
 *       Thin boolean-returning variant that probes Redis readiness at
 *       call time (via isRedisReady) and falls back to the memory
 *       backend when Redis is configured but unreachable. Shares the
 *       role-multiplier pipeline with rateLimitForRole via the private
 *       resolveRoleMultiplier helper. Prefer this in new code paths
 *       where only the allow/deny bit matters.
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
 * Pick the backend on first use (not at module load) so that `next build`
 * doesn't refuse to compile when REDIS_URL is only present at runtime.
 *
 * In production, REDIS_URL is mandatory: the memory backend is process-local
 * and breaks under multi-worker deployments (PM2 cluster, multi-pod), leaving
 * rate limits trivially bypassable. When a production server actually tries
 * to rate-limit a request without Redis configured, we fail the request loudly
 * instead of silently falling back. Dev and test environments always allow
 * the memory backend. Set ALLOW_MEMORY_RATE_LIMIT=1 to override in production
 * if you genuinely run a single worker and accept the risk.
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
        // Do NOT cache this — we want to pick up the correct backend as soon
        // as operators set REDIS_URL and restart / the env becomes readable.
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
    return getActiveBackend().hit(identifier, config);
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
 * Resolve a role's effective multiplier from the Setting cache.
 * Returns 1 as the safe default on any missing entry / error.
 * Shared by both rateLimitForRole and rateLimitForRoleAsync so the
 * multiplier lookup code lives in exactly one place.
 */
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

/**
 * Apply the role multiplier to the base config. Returns `null` when the
 * multiplier is 0 (unlimited) so callers can short-circuit.
 */
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
    const multiplier = await resolveRoleMultiplier(role);
    const effective = applyMultiplier(baseConfig, multiplier);
    if (effective === null) {
        return { success: true, remaining: Number.POSITIVE_INFINITY, resetAt: 0 };
    }
    return rateLimit(identifier, effective);
}

/**
 * Boolean-returning role-aware rate limiter.
 *
 * Differs from {@link rateLimitForRole} in two ways:
 *  1. Picks the backend at CALL time — probes Redis readiness with
 *     {@link isRedisReady} and uses the Redis backend only if currently
 *     reachable, otherwise transparently uses the memory backend. This
 *     lets long-running processes recover from a Redis outage without
 *     a restart.
 *  2. Returns just the allow/deny bit (`Promise<boolean>`) for callers
 *     that don't need remaining/resetAt metadata.
 *
 * The existing sync-shaped call sites of {@link rateLimitForRole} are
 * NOT affected — that function still uses the module-load-time selected
 * `activeBackend` and returns a full `RateLimitResult`.
 */
export async function rateLimitForRoleAsync(
    identifier: string,
    baseConfig: RateLimitConfig,
    role?: string | null
): Promise<boolean> {
    const multiplier = await resolveRoleMultiplier(role);
    const effective = applyMultiplier(baseConfig, multiplier);
    if (effective === null) return true;

    // When Redis is configured, probe readiness per-call so a flaky Redis
    // can transparently fall back to memory for this one request (logged
    // via warnRedisFallback in RedisBackend). When Redis is NOT configured
    // at all, go through getActiveBackend() so the production misconfig
    // guard kicks in rather than silently using the memory backend.
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
