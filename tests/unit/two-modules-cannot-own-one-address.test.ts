import { describe, it, expect } from "vitest";
import { findApiPathConflicts } from "@/core/lib/module-api-conflicts";

/**
 * A module arrives in a ZIP from outside, and it says where it answers.
 *
 * `matchApiRoute` resolves a request with `ModuleApiRoutes.find(r => r.path
 * === urlPath)`: the first declaration wins and the rest are unreachable,
 * with nothing said. Install checks a great deal - the id's shape, the
 * archive's entries, declared dependencies, declared module conflicts - but
 * never whether the paths a module claims are already answered. Nav groups
 * got that check; addresses did not.
 *
 * Measured over the 78 modules in the tree: 166 declared endpoints, no two
 * modules claiming one path today. Which is the moment to fix the order of
 * arrival deciding who answers `/store/orders`.
 *
 * Declaring one handler at several paths stays legal, and so does a module
 * re-declaring its own paths: an upgrade reinstalls what is already there.
 * Only another module's address is taken.
 */

describe("a module's declared addresses", () => {
    it("may be several for one handler", () => {
        const conflicts = findApiPathConflicts(
            { module: "store", paths: ["/product-variables", "/store/product-variables"] },
            [],
        );
        expect(conflicts).toEqual([]);
    });

    it("may repeat what the same module already owns, because upgrades reinstall", () => {
        const conflicts = findApiPathConflicts(
            { module: "store", paths: ["/store/orders"] },
            [{ module: "store", paths: ["/store/orders"] }],
        );
        expect(conflicts).toEqual([]);
    });

    it("may sit beside another module's different addresses", () => {
        const conflicts = findApiPathConflicts(
            { module: "blog", paths: ["/blog/articles"] },
            [{ module: "store", paths: ["/store/orders"] }],
        );
        expect(conflicts).toEqual([]);
    });

    it("may not take an address another module already answers", () => {
        const conflicts = findApiPathConflicts(
            { module: "evil", paths: ["/store/orders"] },
            [{ module: "store", paths: ["/store/orders"] }],
        );
        expect(conflicts).toEqual([{ path: "/store/orders", owner: "store" }]);
    });

    it("names every taken address, not only the first", () => {
        const conflicts = findApiPathConflicts(
            { module: "evil", paths: ["/store/orders", "/blog/articles", "/evil/own"] },
            [
                { module: "store", paths: ["/store/orders"] },
                { module: "blog", paths: ["/blog/articles"] },
            ],
        );
        expect(conflicts).toEqual([
            { path: "/store/orders", owner: "store" },
            { path: "/blog/articles", owner: "blog" },
        ]);
    });

    it("reads a trailing slash and a missing one as the same address", () => {
        // The matcher compares the request path as it arrives. A claim that
        // differs only by a slash would pass a naive check and then shadow.
        const conflicts = findApiPathConflicts(
            { module: "evil", paths: ["/store/orders/"] },
            [{ module: "store", paths: ["/store/orders"] }],
        );
        expect(conflicts).toEqual([{ path: "/store/orders/", owner: "store" }]);
    });
});
