import { describe, it, expect } from "vitest";
import { resolveDependencyBadge } from "@/app/[locale]/(admin)/admin/modules/module-display";

const installed = [
    { id: "store", name: "Store", version: "2.0.0", enabled: true },
    { id: "blog", name: "Blog", version: "1.4.0", enabled: false },
    { id: "legacy", name: "Legacy", enabled: true },
];

const catalogue = [
    { id: "store", name: "Store" },
    { id: "tickets", name: "Tickets" },
];

describe("resolveDependencyBadge", () => {
    it("satisfies a ranged dependency whose installed version matches", () => {
        // The bug this replaced compared "store@^2.0.0" against module ids and
        // reported it missing on an install that had store 2.0.0 enabled.
        const badge = resolveDependencyBadge("store@^2.0.0", installed, catalogue);
        expect(badge).toMatchObject({
            id: "store",
            range: "^2.0.0",
            label: "Store ^2.0.0",
            satisfied: true,
            versionMismatch: false,
        });
    });

    it("satisfies a bare dependency on an enabled module", () => {
        const badge = resolveDependencyBadge("store", installed, catalogue);
        expect(badge.satisfied).toBe(true);
        expect(badge.range).toBeUndefined();
        expect(badge.label).toBe("Store");
    });

    it("reports a version mismatch separately from a missing module", () => {
        const badge = resolveDependencyBadge("store@^3.0.0", installed, catalogue);
        expect(badge.satisfied).toBe(false);
        expect(badge.versionMismatch).toBe(true);
    });

    it("treats a module that is installed but disabled as not satisfied", () => {
        const badge = resolveDependencyBadge("blog@^1.0.0", installed, catalogue);
        expect(badge.satisfied).toBe(false);
        expect(badge.versionMismatch).toBe(false);
    });

    it("cannot vouch for a range when the installed version is unknown", () => {
        const badge = resolveDependencyBadge("legacy@^1.0.0", installed, catalogue);
        expect(badge.satisfied).toBe(false);
        expect(badge.versionMismatch).toBe(true);
    });

    it("falls back to the catalogue name, then the id", () => {
        expect(resolveDependencyBadge("tickets", installed, catalogue).label).toBe("Tickets");
        expect(resolveDependencyBadge("unknown-thing", installed, catalogue).label).toBe("unknown-thing");
        expect(resolveDependencyBadge("tickets", installed).label).toBe("tickets");
    });

    it("keeps the raw spec so it can be used as a React key", () => {
        expect(resolveDependencyBadge("store@^2.0.0", installed).spec).toBe("store@^2.0.0");
    });

    it("does not crash on a spec that bypassed manifest validation", () => {
        const badge = resolveDependencyBadge("Not A Spec", installed, catalogue);
        expect(badge.satisfied).toBe(false);
        expect(badge.label).toBe("Not A Spec");
    });
});
