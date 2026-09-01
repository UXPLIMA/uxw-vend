import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/core/lib/db", () => ({
    prisma: { moduleConfig: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import {
    parseDependency,
    checkCoreCompatibility,
    checkModuleDependencies,
    dependencyErrorMessage,
    type DependencyCheckFailure,
} from "@/core/lib/module-dependencies";

/** Shape the mocked `moduleConfig.findMany` returns. */
function installed(rows: Array<{ id: string; enabled: boolean }>) {
    findMany.mockResolvedValue(rows);
}

const base = { id: "demo" };

beforeEach(() => {
    findMany.mockReset();
    installed([]);
});

describe("parseDependency", () => {
    it("splits a bare id", () => {
        expect(parseDependency("store")).toEqual({ id: "store" });
    });

    it("splits an id@range", () => {
        expect(parseDependency("store@^1.2.0")).toEqual({ id: "store", range: "^1.2.0" });
        expect(parseDependency("store@>=1.0.0 <2.0.0")).toEqual({
            id: "store",
            range: ">=1.0.0 <2.0.0",
        });
    });

    it("treats an unparseable spec as a plain id so it surfaces as missing", () => {
        expect(parseDependency("Not/An/Id")).toEqual({ id: "Not/An/Id" });
    });
});

describe("checkCoreCompatibility", () => {
    it("passes when no range is declared", () => {
        expect(checkCoreCompatibility({}, "1.0.0")).toEqual({ ok: true });
    });

    it("passes when the running core satisfies the range", () => {
        expect(checkCoreCompatibility({ coreVersion: "^1.0.0" }, "1.4.2")).toEqual({ ok: true });
    });

    it("fails when the running core is outside the range", () => {
        expect(checkCoreCompatibility({ coreVersion: "^1.0.0" }, "2.0.0")).toEqual({
            ok: false,
            coreIncompatible: { required: "^1.0.0", actual: "2.0.0" },
        });
    });
});

describe("checkModuleDependencies", () => {
    it("passes for a manifest with nothing declared", async () => {
        expect(await checkModuleDependencies(base)).toEqual({ ok: true });
        expect(findMany).not.toHaveBeenCalled();
    });

    it("reports a dependency that is not installed", async () => {
        installed([]);
        const r = (await checkModuleDependencies({
            ...base,
            dependencies: ["store"],
        })) as DependencyCheckFailure;
        expect(r.ok).toBe(false);
        expect(r.missingDependencies).toEqual(["store"]);
    });

    it("reports a dependency that is installed but disabled", async () => {
        installed([{ id: "store", enabled: false }]);
        const r = (await checkModuleDependencies({
            ...base,
            dependencies: ["store"],
        })) as DependencyCheckFailure;
        expect(r.disabledDependencies).toEqual(["store"]);
    });

    it("queries the bare id, not the id@range spec", async () => {
        installed([{ id: "store", enabled: true }]);
        await checkModuleDependencies(
            { ...base, dependencies: ["store@^1.0.0"] },
            { installedVersions: { store: "1.4.0" } },
        );
        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: { in: ["store"] } } }),
        );
    });

    it("accepts an installed version inside the declared range", async () => {
        installed([{ id: "store", enabled: true }]);
        const r = await checkModuleDependencies(
            { ...base, dependencies: ["store@^1.2.0"] },
            { installedVersions: { store: "1.9.0" } },
        );
        expect(r).toEqual({ ok: true });
    });

    it("reports an installed version outside the declared range", async () => {
        installed([{ id: "store", enabled: true }]);
        const r = (await checkModuleDependencies(
            { ...base, dependencies: ["store@^2.0.0"] },
            { installedVersions: { store: "1.9.0" } },
        )) as DependencyCheckFailure;
        expect(r.versionMismatches).toEqual([
            { id: "store", required: "^2.0.0", installed: "1.9.0" },
        ]);
    });

    it("fails closed when a range is declared but the version is unreadable", async () => {
        installed([{ id: "store", enabled: true }]);
        const r = (await checkModuleDependencies({
            ...base,
            dependencies: ["store@^2.0.0"],
        })) as DependencyCheckFailure;
        expect(r.versionMismatches).toEqual([
            { id: "store", required: "^2.0.0", installed: "unknown" },
        ]);
    });

    it("ignores a version range on a dependency that is merely absent", async () => {
        installed([]);
        const r = (await checkModuleDependencies({
            ...base,
            dependencies: ["store@^2.0.0"],
        })) as DependencyCheckFailure;
        expect(r.missingDependencies).toEqual(["store"]);
        expect(r.versionMismatches).toBeUndefined();
    });

    it("reports only conflicts that are actually enabled", async () => {
        installed([
            { id: "legacy-store", enabled: false },
            { id: "other-store", enabled: true },
        ]);
        const r = (await checkModuleDependencies({
            ...base,
            conflicts: ["legacy-store", "other-store"],
        })) as DependencyCheckFailure;
        expect(r.activeConflicts).toEqual(["other-store"]);
    });

    it("narrows a ranged conflict to the clashing versions", async () => {
        installed([{ id: "other", enabled: true }]);
        const clear = await checkModuleDependencies(
            { ...base, conflicts: ["other@^1.0.0"] },
            { installedVersions: { other: "2.0.0" } },
        );
        expect(clear).toEqual({ ok: true });

        const clash = (await checkModuleDependencies(
            { ...base, conflicts: ["other@^1.0.0"] },
            { installedVersions: { other: "1.5.0" } },
        )) as DependencyCheckFailure;
        expect(clash.activeConflicts).toEqual(["other"]);
    });

    it("surfaces core incompatibility even with no dependencies to query", async () => {
        const r = (await checkModuleDependencies(
            { ...base, coreVersion: "^2.0.0" },
            { coreApiVersion: "1.0.0" },
        )) as DependencyCheckFailure;
        expect(r.coreIncompatible).toEqual({ required: "^2.0.0", actual: "1.0.0" });
        expect(findMany).not.toHaveBeenCalled();
    });

    it("reports every distinct problem in one pass", async () => {
        installed([{ id: "b", enabled: false }, { id: "c", enabled: true }]);
        const r = (await checkModuleDependencies(
            { ...base, dependencies: ["a", "b"], conflicts: ["c"], coreVersion: "^9.0.0" },
            { coreApiVersion: "1.0.0" },
        )) as DependencyCheckFailure;
        expect(r.missingDependencies).toEqual(["a"]);
        expect(r.disabledDependencies).toEqual(["b"]);
        expect(r.activeConflicts).toEqual(["c"]);
        expect(r.coreIncompatible).toBeDefined();
    });
});

describe("dependencyErrorMessage", () => {
    it("names every failure category it was given", () => {
        const msg = dependencyErrorMessage({
            ok: false,
            missingDependencies: ["a"],
            disabledDependencies: ["b"],
            activeConflicts: ["c"],
            versionMismatches: [{ id: "d", required: "^2.0.0", installed: "1.0.0" }],
            coreIncompatible: { required: "^9.0.0", actual: "1.0.0" },
        });
        expect(msg).toContain("core ^9.0.0");
        expect(msg).toContain("not-installed modules: a");
        expect(msg).toContain("disabled modules: b");
        expect(msg).toContain("conflicts with active modules: c");
        expect(msg).toContain("d@^2.0.0 (installed 1.0.0)");
    });

    it("falls back to a generic message when nothing is populated", () => {
        expect(dependencyErrorMessage({ ok: false })).toBe("module dependency check failed");
    });
});
