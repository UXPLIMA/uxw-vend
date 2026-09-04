import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { findDependents } from "@/core/lib/module-dependencies";

const root = path.resolve(import.meta.dirname, "../..");

/**
 * Uninstalling could brick the next build.
 *
 * Disabling a module refuses while an enabled module depends on it. Uninstall
 * is the same operation with the files deleted too, and it had no such check.
 *
 * Removing `store` while `leaderboard` was installed took the `Order` model
 * out of the merged Prisma schema, and `leaderboard/api/route.ts` still called
 * `prisma.order`. The rebuild that uninstall schedules then failed, so the
 * site stayed on the last good build with no way forward from the admin panel
 * - the module it would need to reinstall was the one whose files were gone.
 *
 * Sixteen of the shipped modules declare a dependency, fifteen of them on
 * `store`, so this was one click away on any real install.
 */
describe("findDependents", () => {
    const DEFS = [
        { id: "store", dependencies: ["currency"] },
        { id: "leaderboard", dependencies: ["store"] },
        { id: "paypal-gateway", dependencies: ["store@^2.0.0"] },
        { id: "blog", dependencies: [] },
        { id: "forum" },
    ];

    it("finds who depends on a module, version range or not", () => {
        expect(findDependents("store", DEFS).sort()).toEqual(["leaderboard", "paypal-gateway"]);
    });

    it("follows the declaration, not the other direction", () => {
        // store depends on currency; currency depends on nothing.
        expect(findDependents("currency", DEFS)).toEqual(["store"]);
        expect(findDependents("leaderboard", DEFS)).toEqual([]);
    });

    it("never counts a module as its own dependent", () => {
        expect(findDependents("store", [{ id: "store", dependencies: ["store"] }])).toEqual([]);
    });

    it("copes with a manifest that declares nothing", () => {
        expect(findDependents("store", [{ id: "forum" }])).toEqual([]);
    });

    it("can narrow to the modules that are running", () => {
        const enabled = new Set(["leaderboard"]);
        expect(
            findDependents("store", DEFS, { onlyEnabled: (id) => enabled.has(id) }),
        ).toEqual(["leaderboard"]);
    });

    it("treats every installed module as a dependent when no filter is given", () => {
        // Uninstall passes no filter on purpose: the schema merge and the
        // registry build read the filesystem, so a disabled dependent still
        // contributes code referencing the removed module's models.
        expect(findDependents("store", DEFS).length).toBe(2);
    });
});

describe("the uninstall route", () => {
    const source = fs.readFileSync(
        path.join(root, "src/app/api/v1/modules/[id]/route.ts"),
        "utf8",
    );

    it("refuses before it deletes anything", () => {
        expect(source).toContain("findDependents(moduleId, moduleSystem.getDefinitions())");
        const guard = source.indexOf("dependents.length > 0");
        const remove = source.indexOf("fs.rm(moduleDir");
        expect(guard).toBeGreaterThan(-1);
        expect(remove).toBeGreaterThan(-1);
        expect(guard, "the check has to come before the files go").toBeLessThan(remove);
    });

    it("does not narrow the check to enabled modules", () => {
        const guard = source.slice(source.indexOf("const dependents ="), source.indexOf("const exists ="));
        expect(guard).not.toContain("onlyEnabled");
    });
});

/**
 * The dependency graph the guard protects is real, not hypothetical: these are
 * the manifests as shipped.
 */
describe("the shipped modules", () => {
    const manifests = fs.readdirSync(path.join(root, "module-sources"), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(root, "module-sources", e.name, "module.json"))
        .filter((f) => fs.existsSync(f))
        .map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as { id: string; dependencies?: string[] });

    it("include modules that depend on store", () => {
        expect(findDependents("store", manifests).length).toBeGreaterThan(5);
    });

    it("declare every dependency against a module that exists", () => {
        const ids = new Set(manifests.map((m) => m.id));
        const dangling: string[] = [];
        for (const m of manifests) {
            for (const spec of m.dependencies ?? []) {
                const id = spec.split("@")[0];
                if (!ids.has(id)) dangling.push(`${m.id} -> ${spec}`);
            }
        }
        expect(dangling).toEqual([]);
    });
});

/**
 * A module leaves rows behind in core's tables, and one of them was nobody's.
 *
 * The scheduler keys a `CronRun` row per job as `<moduleId>:<jobId>`, and
 * uninstall cleared `ModuleConfig` and the module's translations but never
 * those. A demo box was carrying rows for three modules that had not been
 * installed for some time. They are inert while the module is gone, since a
 * tick only walks registered jobs, but a reinstall inherits the stale
 * `lastRunAt`, and a monthly job then sits out the remainder of an interval
 * that elapsed while it did not exist.
 *
 * Module-owned tables are preserved for reinstall on purpose, and that is the
 * admin's data. A scheduling timestamp is not.
 */
describe("uninstall", () => {
    const source = fs.readFileSync(
        path.join(root, "src/app/api/v1/modules/[id]/route.ts"),
        "utf8",
    );

    it("clears the module's cron bookkeeping", () => {
        expect(source).toContain("prisma.cronRun");
        expect(source).toContain("jobKey: { startsWith: `${moduleId}:` }");
    });

    it("still clears the config row and the translations", () => {
        expect(source).toContain('prisma.moduleConfig.deleteMany({ where: { id: moduleId } })');
        expect(source).toContain("removeModuleTranslations(moduleId)");
    });

    it("still preserves the module's own tables", () => {
        // Reinstalling must not lose what the admin put in the module.
        expect(source).toContain("intentionally preserved");
        expect(source).not.toMatch(/DROP TABLE/i);
    });
});
