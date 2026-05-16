// @vitest-environment node
/**
 * Rate-limit Redis -> memory failover.
 *
 * RedisBackend.hit catches any error thrown by getRedisClient/redis.set
 * and falls through to memoryHitSync. This test:
 *   - Stubs getRedisClient to return a client whose .set always throws
 *   - Calls rateLimit 3 times against a small limit (maxRequests:3) — each
 *     returns success because the memory fallback is incrementing locally
 *   - 4th call returns success:false
 *
 * REDIS_URL is set in the env so isRedisConfigured() returns true and the
 * RedisBackend is selected; the fallthrough path is what we want to cover.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

vi.mock("@/core/lib/db", () => ({
    prisma: { setting: { findUnique: async () => null } },
}));

const fakeRedis = {
    isOpen: true,
    get: vi.fn(async () => null),
    set: vi.fn(async () => { throw new Error("simulated Redis SET failure"); }),
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

beforeEach(async () => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://stub:6379";
    fakeRedis.set.mockClear();
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe("rate-limit failover", () => {
    it("falls back to memory when Redis throws on every hit and tracks counts locally", async () => {
        const { rateLimit } = await import("@/core/lib/rate-limit");
        const id = "failover-test-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        const config = { maxRequests: 3, windowMs: 60_000 };

        const r1 = await rateLimit(id, config);
        const r2 = await rateLimit(id, config);
        const r3 = await rateLimit(id, config);
        const r4 = await rateLimit(id, config);

        // First three allowed via the memory fallback
        expect(r1.success).toBe(true);
        expect(r2.success).toBe(true);
        expect(r3.success).toBe(true);

        // Fourth call: memory bucket exhausted
        expect(r4.success).toBe(false);
        expect(r4.remaining).toBe(0);

        // Sanity: redis.set was called (and threw) on every hit — confirms
        // we exercised the failover path, not just the memory backend
        // outright.
        expect(fakeRedis.set).toHaveBeenCalledTimes(4);
    });
});
