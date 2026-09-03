import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * getModuleStates is consulted during SSR and during `next build`'s
 * static-collection phase, where DATABASE_URL may not resolve at all. It
 * therefore has to treat an unreachable database as "no states known" and
 * let consumers default to enabled - returning false there would 404 every
 * module the moment the database blinked. Nothing tested that.
 */

const { moduleConfig, cacheGetJSON, cacheSetJSON, cacheDel } = vi.hoisted(() => ({
    moduleConfig: { findMany: vi.fn() },
    cacheGetJSON: vi.fn(),
    cacheSetJSON: vi.fn(),
    cacheDel: vi.fn(),
}));

vi.mock("@/core/lib/db", () => ({
    prisma: { moduleConfig },
    default: { moduleConfig },
}));

vi.mock("@/core/lib/redis", () => ({ cacheGetJSON, cacheSetJSON, cacheDel }));

import {
    getModuleStates,
    isModuleEnabled,
    invalidateModuleCache,
} from "@/core/lib/module-cache";

let consoleWarn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    moduleConfig.findMany.mockReset().mockResolvedValue([]);
    cacheGetJSON.mockReset().mockResolvedValue(null);
    cacheSetJSON.mockReset().mockResolvedValue(undefined);
    cacheDel.mockReset().mockResolvedValue(undefined);
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => { });
    vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("getModuleStates", () => {
    it("serves a cache hit without touching the database", async () => {
        cacheGetJSON.mockResolvedValue({ shop: true });

        await expect(getModuleStates()).resolves.toEqual({ shop: true });
        expect(moduleConfig.findMany).not.toHaveBeenCalled();
    });

    it("reads the shared cache key", async () => {
        await getModuleStates();
        expect(cacheGetJSON).toHaveBeenCalledWith("uxw:modules:status");
    });

    it("builds the map from the config rows on a miss", async () => {
        moduleConfig.findMany.mockResolvedValue([
            { id: "shop", enabled: true },
            { id: "blog", enabled: false },
        ]);

        await expect(getModuleStates()).resolves.toEqual({ shop: true, blog: false });
    });

    it("caches what it just built, for thirty seconds", async () => {
        moduleConfig.findMany.mockResolvedValue([{ id: "shop", enabled: true }]);

        await getModuleStates();

        expect(cacheSetJSON).toHaveBeenCalledWith(
            "uxw:modules:status", { shop: true }, 30,
        );
    });

    it("selects only the two columns it needs", async () => {
        await getModuleStates();
        expect(moduleConfig.findMany).toHaveBeenCalledWith({
            select: { id: true, enabled: true },
        });
    });

    it("returns an empty map when the database is unreachable", async () => {
        moduleConfig.findMany.mockRejectedValue(new Error("ECONNREFUSED"));

        await expect(getModuleStates()).resolves.toEqual({});
    });

    it("does not cache the empty map from a failed read", async () => {
        moduleConfig.findMany.mockRejectedValue(new Error("ECONNREFUSED"));

        await getModuleStates();

        expect(cacheSetJSON).not.toHaveBeenCalled();
    });

    it("warns about the failure outside production", async () => {
        moduleConfig.findMany.mockRejectedValue(new Error("ECONNREFUSED"));
        await getModuleStates();

        expect(consoleWarn).toHaveBeenCalled();
    });

    it("stays quiet in production, where this is expected during build", async () => {
        vi.stubEnv("NODE_ENV", "production");
        moduleConfig.findMany.mockRejectedValue(new Error("ECONNREFUSED"));

        await getModuleStates();

        expect(consoleWarn).not.toHaveBeenCalled();
    });

    it("serves a cached empty map instead of re-querying", async () => {
        // An empty map is only ever cached after a *successful* read, so it
        // means "there are genuinely no rows" - not "the read failed".
        cacheGetJSON.mockResolvedValue({});

        await expect(getModuleStates()).resolves.toEqual({});
        expect(moduleConfig.findMany).not.toHaveBeenCalled();
    });
});

describe("isModuleEnabled", () => {
    it("reports an explicitly enabled module", async () => {
        cacheGetJSON.mockResolvedValue({ shop: true });
        await expect(isModuleEnabled("shop")).resolves.toBe(true);
    });

    it("reports an explicitly disabled module", async () => {
        cacheGetJSON.mockResolvedValue({ shop: false });
        await expect(isModuleEnabled("shop")).resolves.toBe(false);
    });

    it("defaults an unknown module to enabled", async () => {
        cacheGetJSON.mockResolvedValue({ blog: true });

        // A missing row means "no explicit state known", matching what
        // /api/v1/modules already does.
        await expect(isModuleEnabled("shop")).resolves.toBe(true);
    });

    it("defaults to enabled during a database outage", async () => {
        moduleConfig.findMany.mockRejectedValue(new Error("ECONNREFUSED"));

        // Defaulting to false here would 404 every module at once.
        await expect(isModuleEnabled("shop")).resolves.toBe(true);
    });
});

describe("invalidateModuleCache", () => {
    it("drops the shared key so the next read re-queries", async () => {
        await invalidateModuleCache();
        expect(cacheDel).toHaveBeenCalledWith("uxw:modules:status");
    });
});
