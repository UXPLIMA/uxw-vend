// @vitest-environment node
/**
 * The Redis backend has to count a burst.
 *
 * It used to GET the counter, add one in Node, and SET it back. Those are two
 * round trips, and requests that overlap between them all read the same number
 * and all write the same number back, so ten simultaneous requests could be
 * recorded as one. A burst is exactly what the limiter exists to stop, so the
 * hole opened under the only traffic that matters.
 *
 * The fake below behaves like a Redis server: every command yields once before
 * it runs (the round trip), and the script body then runs to completion without
 * yielding (server-side atomicity). Under a read-modify-write client that fake
 * loses hits; under a single EVAL it cannot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

vi.mock("@/core/lib/db", () => ({
    prisma: { setting: { findUnique: async () => null } },
}));

interface Entry {
    value: number;
    expiresAt: number | null;
}

const store = new Map<string, Entry>();

/**
 * The fake server's clock. Left null it is the wall clock; a test that wants a
 * window to expire sets it and moves it forward. Sleeping for a real 20ms
 * window instead made the expiry test fail whenever a loaded machine took
 * longer than the window to get between two awaits.
 */
let serverClock: number | null = null;
const serverNow = () => serverClock ?? Date.now();

/** One network round trip: control returns to the event loop exactly once. */
const roundTrip = () => new Promise((resolve) => setTimeout(resolve, 0));

const fakeRedis = {
    isOpen: true,
    get: vi.fn(async (key: string) => {
        await roundTrip();
        const entry = store.get(key);
        return entry ? String(entry.value) : null;
    }),
    set: vi.fn(async (key: string, value: string, options?: { PX?: number }) => {
        await roundTrip();
        store.set(key, {
            value: Number(value),
            expiresAt: options?.PX ? serverNow() + options.PX : null,
        });
        return "OK";
    }),
    // Deliberately synchronous after the single await: this is the property a
    // real server gives a script, and the property the old code did not have.
    eval: vi.fn(async (_script: string, options?: { keys?: string[]; arguments?: string[] }) => {
        await roundTrip();
        const key = options?.keys?.[0] as string;
        const windowMs = Number(options?.arguments?.[0]);
        const existing = store.get(key);
        const live = existing && (existing.expiresAt === null || existing.expiresAt > serverNow());
        const entry: Entry = live
            ? existing!
            : { value: 0, expiresAt: serverNow() + windowMs };
        entry.value += 1;
        store.set(key, entry);
        const ttl = entry.expiresAt === null ? -1 : entry.expiresAt - serverNow();
        return [entry.value, ttl];
    }),
    del: vi.fn(),
    ping: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
};

vi.mock("@/core/lib/redis", () => ({
    getRedisClient: async () => fakeRedis,
    isRedisConfigured: () => true,
}));

beforeEach(() => {
    vi.resetModules();
    store.clear();
    serverClock = null;
    fakeRedis.eval.mockClear();
    process.env.REDIS_URL = "redis://stub:6379";
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe("Redis rate-limit backend", () => {
    it("counts every request in a simultaneous burst", async () => {
        const { rateLimit } = await import("@/core/lib/rate-limit");
        const id = "burst-" + Math.random().toString(36).slice(2, 10);
        const config = { maxRequests: 5, windowMs: 60_000 };

        const results = await Promise.all(
            Array.from({ length: 10 }, () => rateLimit(id, config)),
        );

        expect(results.filter((r) => r.success)).toHaveLength(5);
        expect(results.filter((r) => !r.success)).toHaveLength(10 - 5);
        expect(store.get(`rlc:${id}`)?.value).toBe(10);
        expect(fakeRedis.eval).toHaveBeenCalledTimes(10);
    });

    it("reports remaining and resetAt from the server's own TTL", async () => {
        const { rateLimit } = await import("@/core/lib/rate-limit");
        const id = "single-" + Math.random().toString(36).slice(2, 10);
        const config = { maxRequests: 3, windowMs: 30_000 };

        const first = await rateLimit(id, config);
        expect(first).toMatchObject({ success: true, remaining: 2 });
        expect(first.resetAt).toBeGreaterThan(Date.now());
        expect(first.resetAt).toBeLessThanOrEqual(Date.now() + 30_000);

        const second = await rateLimit(id, config);
        expect(second.remaining).toBe(1);
    });

    it("expires the window rather than blocking forever", async () => {
        const { rateLimit } = await import("@/core/lib/rate-limit");
        const id = "expiry-" + Math.random().toString(36).slice(2, 10);
        const config = { maxRequests: 1, windowMs: 20_000 };

        serverClock = Date.now();
        expect((await rateLimit(id, config)).success).toBe(true);
        expect((await rateLimit(id, config)).success).toBe(false);

        serverClock += 20_001;

        expect((await rateLimit(id, config)).success).toBe(true);
    });
});
