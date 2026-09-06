import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A rate limit check costs one round trip, not two.
 *
 * `rateLimitForRoleAsync` is the entry point every rate-limited route uses -
 * a cart update, a forum like, an activity feed poll, the health check. It
 * used to PING Redis first and choose a backend from the answer, so each of
 * those requests paid two round trips where one would do.
 *
 * The probe was not what made the limiter survive a Redis outage. The Redis
 * backend fetches its client and catches its own errors on every hit, falling
 * through to the in-process counter and saying so in the log; `rateLimit` has
 * always depended on exactly that. This test holds the three entry points to
 * one shared path, so the boolean variant cannot grow a second one again.
 */

const ping = vi.fn(async () => "PONG");
const evalScript = vi.fn(async () => [1, 60_000]);

vi.mock("@/core/lib/redis", () => ({
    isRedisConfigured: () => true,
    getRedisClient: async () => ({ ping, eval: evalScript }),
}));

vi.mock("@/core/lib/db", () => ({
    prisma: { setting: { findUnique: async () => null } },
}));

vi.mock("@/core/lib/logger", () => ({ log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

describe("a rate-limited request", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it("hits Redis once, and does not ping it first", async () => {
        const mod = await import("@/core/lib/rate-limit");
        mod.invalidateRoleMultiplierCache();

        const allowed = await mod.rateLimitForRoleAsync("one:round:trip", { maxRequests: 5, windowMs: 60_000 }, "member");

        expect(allowed).toBe(true);
        expect(evalScript).toHaveBeenCalledTimes(1);
        expect(ping).not.toHaveBeenCalled();
    });

    it("still counts, and still refuses past the limit", async () => {
        const mod = await import("@/core/lib/rate-limit");
        mod.invalidateRoleMultiplierCache();

        evalScript.mockResolvedValueOnce([1, 60_000]);
        expect(await mod.rateLimitForRoleAsync("counts", { maxRequests: 2, windowMs: 60_000 }, null)).toBe(true);
        evalScript.mockResolvedValueOnce([3, 60_000]);
        expect(await mod.rateLimitForRoleAsync("counts", { maxRequests: 2, windowMs: 60_000 }, null)).toBe(false);
    });

    it("keeps counting when Redis fails, rather than letting the request through", async () => {
        const mod = await import("@/core/lib/rate-limit");
        mod.invalidateRoleMultiplierCache();

        evalScript.mockRejectedValue(new Error("connection lost"));
        const config = { maxRequests: 2, windowMs: 60_000 };
        expect(await mod.rateLimitForRoleAsync("outage", config, null)).toBe(true);
        expect(await mod.rateLimitForRoleAsync("outage", config, null)).toBe(true);
        // The in-process counter took over; it did not start allowing everything.
        expect(await mod.rateLimitForRoleAsync("outage", config, null)).toBe(false);
    });

    it("lets an unlimited role through without asking Redis at all", async () => {
        vi.doMock("@/core/lib/db", () => ({
            prisma: { setting: { findUnique: async () => ({ key: "rate_limit_role_multipliers", value: { admin: 0 } }) } },
        }));
        vi.resetModules();
        const mod = await import("@/core/lib/rate-limit");
        mod.invalidateRoleMultiplierCache();

        expect(await mod.rateLimitForRoleAsync("free", { maxRequests: 1, windowMs: 60_000 }, "admin")).toBe(true);
        expect(evalScript).not.toHaveBeenCalled();
        vi.doUnmock("@/core/lib/db");
    });
});
