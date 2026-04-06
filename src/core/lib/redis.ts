/**
 * Redis client singleton with automatic fallback to in-memory Map.
 * Set REDIS_URL env var to enable Redis (e.g. "redis://localhost:6379").
 * When Redis is unavailable, all operations silently fall back to in-memory.
 */

type RedisClientType = {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { PX?: number; EX?: number }): Promise<unknown>;
    del(key: string | string[]): Promise<number>;
    ping(): Promise<string>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isOpen: boolean;
    on(event: string, listener: (...args: unknown[]) => void): void;
};

let client: RedisClientType | null = null;
let connecting = false;
let failed = false;

const REDIS_URL = process.env.REDIS_URL;

/** Get the shared Redis client, or null if unavailable */
export async function getRedisClient(): Promise<RedisClientType | null> {
    if (!REDIS_URL || failed) return null;
    if (client?.isOpen) return client;
    if (connecting) return null;

    connecting = true;
    try {
        // @ts-expect-error -- redis is an optional peer dependency
        const { createClient } = await import("redis");
        const c = createClient({ url: REDIS_URL }) as RedisClientType;
        c.on("error", () => {
            client = null;
            failed = true;
        });
        await c.connect();
        client = c;
        connecting = false;
        return client;
    } catch {
        connecting = false;
        failed = true;
        return null;
    }
}

/** Check if Redis is configured (not necessarily connected) */
export function isRedisConfigured(): boolean {
    return !!REDIS_URL;
}

// ---------------------------------------------------------------------------
// In-memory fallback store
// ---------------------------------------------------------------------------
const memStore = new Map<string, { value: string; expiresAt: number | null }>();

// Cleanup expired entries every 60s
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memStore) {
        if (v.expiresAt && v.expiresAt < now) memStore.delete(k);
    }
}, 60_000);

// ---------------------------------------------------------------------------
// Cache helpers — always work (Redis or in-memory)
// ---------------------------------------------------------------------------

/** Get a cached value by key */
export async function cacheGet(key: string): Promise<string | null> {
    const redis = await getRedisClient();
    if (redis) {
        try {
            return await redis.get(key);
        } catch { /* fall through */ }
    }

    const entry = memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
        memStore.delete(key);
        return null;
    }
    return entry.value;
}

/** Set a cached value with optional TTL in seconds */
export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redis = await getRedisClient();
    if (redis) {
        try {
            if (ttlSeconds) {
                await redis.set(key, value, { EX: ttlSeconds });
            } else {
                await redis.set(key, value);
            }
            return;
        } catch { /* fall through */ }
    }

    memStore.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
}

/** Delete one or more cache keys */
export async function cacheDel(...keys: string[]): Promise<void> {
    const redis = await getRedisClient();
    if (redis) {
        try {
            await redis.del(keys);
            return;
        } catch { /* fall through */ }
    }

    for (const k of keys) memStore.delete(k);
}

/** Get parsed JSON from cache */
export async function cacheGetJSON<T>(key: string): Promise<T | null> {
    const raw = await cacheGet(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

/** Set JSON value in cache */
export async function cacheSetJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await cacheSet(key, JSON.stringify(value), ttlSeconds);
}
