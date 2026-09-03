import { describe, it, expect } from "vitest";
import {
    resolveInstallPlan,
    installPlanErrorMessage,
    type CatalogEntry,
} from "@/core/lib/install-plan";

function entry(id: string, deps: string[] = [], extra: Partial<CatalogEntry> = {}): CatalogEntry {
    return { id, version: "1.0.0", dependencies: deps, ...extra };
}

/** Mirrors the real first-party dependency edges as of 2026-08-31. */
const CATALOG: CatalogEntry[] = [
    entry("currency"),
    entry("credits"),
    entry("store", ["currency"]),
    entry("leaderboard", ["store"]),
    entry("stripe-gateway", ["store"]),
    entry("wheel", ["credits"]),
    entry("blog"),
];

/** True when `a` is installed before `b` in the plan. */
function before(order: string[], a: string, b: string): boolean {
    return order.indexOf(a) < order.indexOf(b) && order.includes(a) && order.includes(b);
}

describe("resolveInstallPlan - expansion", () => {
    it("returns an empty plan for an empty selection", () => {
        expect(resolveInstallPlan([], CATALOG)).toEqual({ order: [], autoAdded: [], errors: [] });
    });

    it("pulls in a transitive dependency and reports it as auto-added", () => {
        const plan = resolveInstallPlan(["store"], CATALOG);
        expect(plan.errors).toEqual([]);
        expect(plan.order).toEqual(["currency", "store"]);
        expect(plan.autoAdded).toEqual(["currency"]);
    });

    it("expands more than one level deep", () => {
        const plan = resolveInstallPlan(["leaderboard"], CATALOG);
        expect(plan.errors).toEqual([]);
        expect(plan.autoAdded).toEqual(["currency", "store"]);
        expect(before(plan.order, "currency", "store")).toBe(true);
        expect(before(plan.order, "store", "leaderboard")).toBe(true);
    });

    it("does not mark an explicitly selected module as auto-added", () => {
        const plan = resolveInstallPlan(["store", "currency"], CATALOG);
        expect(plan.autoAdded).toEqual([]);
        expect(plan.order).toEqual(["currency", "store"]);
    });

    it("de-duplicates a module reached by two paths", () => {
        const plan = resolveInstallPlan(["leaderboard", "stripe-gateway"], CATALOG);
        expect(plan.errors).toEqual([]);
        expect(plan.order.filter((id) => id === "store")).toHaveLength(1);
        expect(new Set(plan.order).size).toBe(plan.order.length);
    });

    it("handles a selection with no dependencies at all", () => {
        const plan = resolveInstallPlan(["blog"], CATALOG);
        expect(plan).toEqual({ order: ["blog"], autoAdded: [], errors: [] });
    });
});

describe("resolveInstallPlan - ordering", () => {
    it("never places a module before something it depends on", () => {
        const plan = resolveInstallPlan(["wheel", "leaderboard", "stripe-gateway"], CATALOG);
        expect(plan.errors).toEqual([]);
        for (const e of CATALOG) {
            for (const dep of e.dependencies ?? []) {
                if (plan.order.includes(e.id) && plan.order.includes(dep)) {
                    expect(before(plan.order, dep, e.id), `${dep} before ${e.id}`).toBe(true);
                }
            }
        }
    });

    it("is deterministic regardless of selection order", () => {
        const a = resolveInstallPlan(["leaderboard", "wheel", "blog"], CATALOG);
        const b = resolveInstallPlan(["blog", "wheel", "leaderboard"], CATALOG);
        expect(a.order).toEqual(b.order);
    });
});

describe("resolveInstallPlan - errors", () => {
    it("reports an unknown module and names what required it", () => {
        const catalog = [entry("a", ["ghost"])];
        const plan = resolveInstallPlan(["a"], catalog);
        expect(plan.errors).toContainEqual({ kind: "unknown", id: "ghost", requiredBy: "a" });
    });

    it("reports an unknown top-level selection with no requiredBy", () => {
        const plan = resolveInstallPlan(["ghost"], CATALOG);
        expect(plan.errors).toContainEqual({ kind: "unknown", id: "ghost", requiredBy: null });
    });

    it("detects a two-node cycle and refuses to order it", () => {
        const catalog = [entry("a", ["b"]), entry("b", ["a"])];
        const plan = resolveInstallPlan(["a"], catalog);
        expect(plan.errors).toContainEqual({ kind: "cycle", ids: ["a", "b"] });
        expect(plan.order).toEqual([]);
    });

    it("detects a longer cycle", () => {
        const catalog = [entry("a", ["b"]), entry("b", ["c"]), entry("c", ["a"])];
        const plan = resolveInstallPlan(["a"], catalog);
        expect(plan.errors.some((e) => e.kind === "cycle")).toBe(true);
    });

    it("still orders the acyclic part alongside a reported cycle", () => {
        const catalog = [entry("a", ["b"]), entry("b", ["a"]), entry("solo")];
        const plan = resolveInstallPlan(["a", "solo"], catalog);
        expect(plan.order).toEqual(["solo"]);
        expect(plan.errors.some((e) => e.kind === "cycle")).toBe(true);
    });

    it("detects a conflict between two selected modules", () => {
        const catalog = [entry("a", [], { conflicts: ["b"] }), entry("b")];
        const plan = resolveInstallPlan(["a", "b"], catalog);
        expect(plan.errors).toContainEqual({ kind: "conflict", a: "a", b: "b" });
    });

    it("detects a conflict with a transitively added module", () => {
        const catalog = [entry("a", [], { conflicts: ["currency"] }), ...CATALOG];
        const plan = resolveInstallPlan(["a", "store"], catalog);
        expect(plan.errors).toContainEqual({ kind: "conflict", a: "a", b: "currency" });
    });

    it("reports a mutual conflict only once", () => {
        const catalog = [entry("a", [], { conflicts: ["b"] }), entry("b", [], { conflicts: ["a"] })];
        const plan = resolveInstallPlan(["a", "b"], catalog);
        expect(plan.errors.filter((e) => e.kind === "conflict")).toHaveLength(1);
    });

    it("clears a ranged conflict when the catalog version is outside it", () => {
        const catalog = [
            entry("a", [], { conflicts: ["b@^1.0.0"] }),
            { id: "b", version: "2.0.0" },
        ];
        const plan = resolveInstallPlan(["a", "b"], catalog);
        expect(plan.errors).toEqual([]);
    });

    it("reports a dependency whose catalog version misses the required range", () => {
        const catalog = [entry("a", ["b@^2.0.0"]), { id: "b", version: "1.0.0" }];
        const plan = resolveInstallPlan(["a"], catalog);
        expect(plan.errors).toContainEqual({
            kind: "version",
            id: "b",
            required: "^2.0.0",
            available: "1.0.0",
            requiredBy: "a",
        });
    });

    it("accepts a dependency whose catalog version satisfies the range", () => {
        const catalog = [entry("a", ["b@^1.0.0"]), { id: "b", version: "1.7.2" }];
        expect(resolveInstallPlan(["a"], catalog).errors).toEqual([]);
    });

    it("reports a module that does not accept the running core", () => {
        const catalog = [entry("a", [], { coreVersion: "^2.0.0" })];
        const plan = resolveInstallPlan(["a"], catalog, { coreApiVersion: "1.0.0" });
        expect(plan.errors).toContainEqual({
            kind: "core",
            id: "a",
            required: "^2.0.0",
            actual: "1.0.0",
        });
    });
});

describe("installPlanErrorMessage", () => {
    it("renders every error kind readably", () => {
        expect(installPlanErrorMessage({ kind: "unknown", id: "g", requiredBy: "a" })).toContain(
            'required by "a"',
        );
        expect(installPlanErrorMessage({ kind: "unknown", id: "g", requiredBy: null })).toBe(
            '"g" is not in the catalog',
        );
        expect(installPlanErrorMessage({ kind: "cycle", ids: ["a", "b"] })).toContain("a, b");
        expect(installPlanErrorMessage({ kind: "conflict", a: "a", b: "b" })).toContain("conflicts");
        expect(
            installPlanErrorMessage({
                kind: "version",
                id: "b",
                required: "^2.0.0",
                available: "1.0.0",
                requiredBy: "a",
            }),
        ).toContain("catalog has 1.0.0");
        expect(
            installPlanErrorMessage({ kind: "core", id: "a", required: "^2.0.0", actual: "1.0.0" }),
        ).toContain("running 1.0.0");
    });
});
