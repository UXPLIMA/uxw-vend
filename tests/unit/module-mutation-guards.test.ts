import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { resolveInstallPlan, type CatalogEntry } from "@/core/lib/install-plan";

const root = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const ROUTES = {
    install: "src/app/api/v1/modules/marketplace/install/route.ts",
    bulkInstall: "src/app/api/v1/modules/marketplace/bulk-install/route.ts",
    update: "src/app/api/v1/modules/update/route.ts",
    uninstall: "src/app/api/v1/modules/[id]/route.ts",
};

/**
 * Four routes write to `src/modules/`, and they have to agree.
 *
 * The uninstall route's own comment described the install lock as the thing
 * "install/update use" - and update was the one route that never took it. An
 * update stages the replacement files and swaps them into the module directory
 * while a concurrent uninstall runs `fs.rm` over it, which can leave a module
 * directory with no `module.json`. Registry generation fails on that, and the
 * next build fails with it.
 */
describe("every route that writes to src/modules", () => {
    it("serializes on the install lock", () => {
        const missing = Object.entries(ROUTES)
            .filter(([, file]) => !read(file).includes("await acquireInstallLock()"))
            .map(([name]) => name);
        expect(missing).toEqual([]);
    });

    it("releases the lock in a finally block", () => {
        for (const [name, file] of Object.entries(ROUTES)) {
            const source = read(file);
            const finallyBlock = source.slice(source.lastIndexOf("} finally {"));
            expect(finallyBlock, `${name} must release the lock`).toContain("releaseLock()");
        }
    });

    it("checks the caller is an admin before anything else", () => {
        for (const [name, file] of Object.entries(ROUTES)) {
            const source = read(file);
            const adminCheck = source.indexOf("isAdmin(session.user.id)");
            const lock = source.indexOf("await acquireInstallLock()");
            expect(adminCheck, `${name} must check isAdmin`).toBeGreaterThan(-1);
            expect(adminCheck, `${name} must check isAdmin before taking the lock`).toBeLessThan(lock);
        }
    });
});

/**
 * The first-run wizard has always expanded a module selection through
 * `resolveInstallPlan`, on the client so the operator can see what a tick
 * pulls in and again on the server so the answer is not the client's to
 * decide. The admin marketplace's bulk install did neither: ticking
 * Leaderboard without ticking Store installed Leaderboard alone, and
 * `leaderboard/api/route.ts` calls `prisma.order`, a model only Store's schema
 * defines. The merged schema came out without it and the rebuild failed.
 */
describe("bulk install", () => {
    const source = read(ROUTES.bulkInstall);

    it("resolves an install plan before it downloads anything", () => {
        const plan = source.indexOf("planBulkInstall(requestedIds)");
        const download = source.indexOf("moduleMarketplaceBase()");
        expect(plan).toBeGreaterThan(-1);
        expect(plan).toBeLessThan(download);
    });

    it("installs in the plan's order, not the request's", () => {
        expect(source).toContain("for (const mod of plan.order)");
    });

    it("takes the zip name from the catalog rather than the caller", () => {
        expect(source).toContain("order.push({ id, zip: entry.zip, name: entry.name })");
    });

    it("tells the caller which modules it added on their behalf", () => {
        expect(source).toContain("autoAdded: plan.autoAdded");
    });
});

/**
 * The planner is what both paths now rely on, so the behaviour that matters to
 * them is pinned here rather than only in the route's shape.
 */
describe("the install plan behind it", () => {
    const CATALOG: CatalogEntry[] = [
        { id: "currency", version: "1.0.0", dependencies: [], conflicts: [] },
        { id: "store", version: "2.0.9", dependencies: ["currency"], conflicts: [] },
        { id: "leaderboard", version: "1.1.0", dependencies: ["store"], conflicts: [] },
    ];

    it("pulls in a dependency the operator did not tick", () => {
        const plan = resolveInstallPlan(["leaderboard"], CATALOG);
        expect(plan.errors).toEqual([]);
        expect(plan.autoAdded.sort()).toEqual(["currency", "store"]);
    });

    it("orders a module after everything it depends on", () => {
        const plan = resolveInstallPlan(["leaderboard"], CATALOG);
        expect(plan.order.indexOf("currency")).toBeLessThan(plan.order.indexOf("store"));
        expect(plan.order.indexOf("store")).toBeLessThan(plan.order.indexOf("leaderboard"));
    });

    it("reports a dependency that is in no catalog at all", () => {
        const plan = resolveInstallPlan(["leaderboard"], [
            { id: "leaderboard", version: "1.1.0", dependencies: ["store"], conflicts: [] },
        ]);
        expect(plan.errors.length).toBeGreaterThan(0);
    });
});
