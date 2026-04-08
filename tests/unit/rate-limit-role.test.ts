import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock redis (not available in test)
vi.mock("redis", () => ({ createClient: vi.fn() }));
vi.mock("@/core/lib/redis", () => ({
    getRedisClient: vi.fn(async () => null),
    isRedisConfigured: () => false,
}));

// Prisma mock — setting row is controlled per-test.
const settingFindUnique = vi.fn();
vi.mock("@/core/lib/db", () => ({
    prisma: {
        setting: { findUnique: (...args: unknown[]) => settingFindUnique(...args) },
    },
}));

vi.mock("@/core/lib/constants", () => ({
    RATE_LIMIT_AUTH: { maxRequests: 10, windowMs: 60000 },
    RATE_LIMIT_API: { maxRequests: 120, windowMs: 60000 },
    RATE_LIMIT_CHECKOUT: { maxRequests: 5, windowMs: 60000 },
    RATE_LIMIT_UPLOAD: { maxRequests: 3, windowMs: 60000 },
}));

type RateLimitModule = typeof import("@/core/lib/rate-limit");
let mod: RateLimitModule;

beforeEach(async () => {
    vi.resetModules();
    settingFindUnique.mockReset();
    mod = await import("@/core/lib/rate-limit");
});

describe("rate-limit: getRoleMultipliers", () => {
    it("returns empty map when no setting row exists", async () => {
        settingFindUnique.mockResolvedValue(null);
        const map = await mod.getRoleMultipliers();
        expect(map.size).toBe(0);
    });

    it("returns parsed multipliers from setting row", async () => {
        settingFindUnique.mockResolvedValue({
            key: "rate_limit_role_multipliers",
            value: { admin: 0, moderator: 5, member: 1 },
        });
        const map = await mod.getRoleMultipliers();
        expect(map.get("admin")).toBe(0);
        expect(map.get("moderator")).toBe(5);
        expect(map.get("member")).toBe(1);
    });

    it("caches the result until invalidated", async () => {
        settingFindUnique.mockResolvedValue({
            key: "rate_limit_role_multipliers",
            value: { admin: 0 },
        });
        await mod.getRoleMultipliers();
        await mod.getRoleMultipliers();
        await mod.getRoleMultipliers();
        expect(settingFindUnique).toHaveBeenCalledTimes(1);

        mod.invalidateRoleMultiplierCache();
        await mod.getRoleMultipliers();
        expect(settingFindUnique).toHaveBeenCalledTimes(2);
    });

    it("ignores out-of-range values", async () => {
        settingFindUnique.mockResolvedValue({
            key: "rate_limit_role_multipliers",
            value: { admin: -1, mod: 200, member: 2 },
        });
        const map = await mod.getRoleMultipliers();
        expect(map.has("admin")).toBe(false);
        expect(map.has("mod")).toBe(false);
        expect(map.get("member")).toBe(2);
    });

    it("returns empty map on DB error", async () => {
        settingFindUnique.mockRejectedValue(new Error("db down"));
        const map = await mod.getRoleMultipliers();
        expect(map.size).toBe(0);
    });
});

describe("rate-limit: rateLimitForRole", () => {
    it("returns unlimited for role with multiplier 0 (admin)", async () => {
        settingFindUnique.mockResolvedValue({
            key: "rate_limit_role_multipliers",
            value: { admin: 0 },
        });
        const result = await mod.rateLimitForRole(
            "admin-user",
            { maxRequests: 2, windowMs: 60000 },
            "admin",
        );
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(Number.POSITIVE_INFINITY);
    });

    it("admin with multiplier 0 never blocks even on many requests", async () => {
        settingFindUnique.mockResolvedValue({
            key: "rate_limit_role_multipliers",
            value: { admin: 0 },
        });
        for (let i = 0; i < 25; i++) {
            const r = await mod.rateLimitForRole(
                "admin-spam-" + i,
                { maxRequests: 1, windowMs: 60000 },
                "admin",
            );
            expect(r.success).toBe(true);
        }
    });

    it("applies multiplier 1 (default) when role has no entry", async () => {
        settingFindUnique.mockResolvedValue({
            key: "rate_limit_role_multipliers",
            value: { admin: 0 },
        });
        const id = "regular-" + Date.now();
        const config = { maxRequests: 2, windowMs: 60000 };
        const r1 = await mod.rateLimitForRole(id, config, "member");
        const r2 = await mod.rateLimitForRole(id, config, "member");
        const r3 = await mod.rateLimitForRole(id, config, "member");
        expect(r1.success).toBe(true);
        expect(r2.success).toBe(true);
        expect(r3.success).toBe(false);
    });

    it("multiplies base max by role multiplier > 1", async () => {
        settingFindUnique.mockResolvedValue({
            key: "rate_limit_role_multipliers",
            value: { moderator: 3 },
        });
        const id = "mod-" + Date.now();
        const config = { maxRequests: 2, windowMs: 60000 }; // base 2 * 3 = 6
        let lastSuccess = true;
        for (let i = 0; i < 6; i++) {
            const r = await mod.rateLimitForRole(id, config, "moderator");
            if (!r.success) lastSuccess = false;
        }
        expect(lastSuccess).toBe(true);
        const r7 = await mod.rateLimitForRole(id, config, "moderator");
        expect(r7.success).toBe(false);
    });

    it("falls back to multiplier 1 when role is undefined", async () => {
        settingFindUnique.mockResolvedValue(null);
        const id = "anon-" + Date.now();
        const config = { maxRequests: 1, windowMs: 60000 };
        const r1 = await mod.rateLimitForRole(id, config);
        const r2 = await mod.rateLimitForRole(id, config);
        expect(r1.success).toBe(true);
        expect(r2.success).toBe(false);
    });
});

describe("rate-limit: rateLimitForRoleAsync", () => {
    it("returns true for unlimited role (multiplier 0)", async () => {
        settingFindUnique.mockResolvedValue({
            key: "rate_limit_role_multipliers",
            value: { admin: 0 },
        });
        const ok = await mod.rateLimitForRoleAsync(
            "admin-bool-" + Date.now(),
            { maxRequests: 1, windowMs: 60000 },
            "admin",
        );
        expect(ok).toBe(true);
    });

    it("returns boolean allow/deny for normal roles", async () => {
        settingFindUnique.mockResolvedValue(null);
        const id = "bool-" + Date.now();
        const config = { maxRequests: 2, windowMs: 60000 };
        expect(await mod.rateLimitForRoleAsync(id, config, "member")).toBe(true);
        expect(await mod.rateLimitForRoleAsync(id, config, "member")).toBe(true);
        expect(await mod.rateLimitForRoleAsync(id, config, "member")).toBe(false);
    });

    it("does not throw on DB error — returns a boolean", async () => {
        settingFindUnique.mockRejectedValue(new Error("db down"));
        const ok = await mod.rateLimitForRoleAsync(
            "err-" + Date.now(),
            { maxRequests: 5, windowMs: 60000 },
            "member",
        );
        expect(typeof ok).toBe("boolean");
        expect(ok).toBe(true);
    });
});

describe("rate-limit: memory backend window reset", () => {
    it("resets counters after windowMs elapses (fake timers)", async () => {
        vi.useFakeTimers();
        try {
            const id = "fake-timer-" + Math.random();
            const config = { maxRequests: 1, windowMs: 1000 };
            const r1 = await mod.rateLimit(id, config);
            const r2 = await mod.rateLimit(id, config);
            expect(r1.success).toBe(true);
            expect(r2.success).toBe(false);

            // Advance past the window
            vi.advanceTimersByTime(1500);
            const r3 = await mod.rateLimit(id, config);
            expect(r3.success).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});
