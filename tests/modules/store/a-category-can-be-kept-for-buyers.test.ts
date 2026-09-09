/**
 * A category shown only to people who bought something.
 *
 * The way a shop puts a members' shelf on a public site: everything in it is
 * for people who already hold the thing that unlocks it, and everybody else
 * should not see the shelf at all. This is the one gate in the store that
 * really does hide rather than advertise - a product's prerequisite is told to
 * the shopper on purpose, because that is how they learn the tier below is
 * worth buying, but a category kept back is kept back.
 *
 * The rule that goes wrong quietly is the second one. Hiding a parent has to
 * hide its children, or the shelf is closed and everything on it is still
 * listed one level down.
 */
import { describe, it, expect } from "vitest";
import { visibleCategories, anyCategoryGated } from "@/modules/store/lib/category-visibility";

const open = { id: "root", parentId: null, visibleAfterProductIds: [] as string[] };
const gated = { id: "vip", parentId: null, visibleAfterProductIds: ["vip-product"] };
const childOfGated = { id: "vip-keys", parentId: "vip", visibleAfterProductIds: [] as string[] };

describe("which categories a reader is shown", () => {
    it("shows an ungated category to everybody", () => {
        expect(visibleCategories([open], new Set()).map((c) => c.id)).toEqual(["root"]);
    });

    it("keeps a gated one back until they own what opens it", () => {
        expect(visibleCategories([gated], new Set()).map((c) => c.id)).toEqual([]);
        expect(visibleCategories([gated], new Set(["vip-product"])).map((c) => c.id)).toEqual(["vip"]);
    });

    it("opens on any one of the list, not all of it", () => {
        const either = { ...gated, visibleAfterProductIds: ["a", "b"] };
        expect(visibleCategories([either], new Set(["b"])).map((c) => c.id)).toEqual(["vip"]);
    });

    it("hides the children of a category it hides", () => {
        // Otherwise the shelf is closed and everything on it is still listed
        // one level down.
        const shown = visibleCategories([gated, childOfGated], new Set()).map((c) => c.id);
        expect(shown).toEqual([]);
    });

    it("shows the children again once the parent opens", () => {
        const shown = visibleCategories([gated, childOfGated], new Set(["vip-product"])).map((c) => c.id);
        expect(shown).toEqual(["vip", "vip-keys"]);
    });

    it("keeps a child whose parent is gone, rather than losing it", () => {
        // A child pointing at a parent that is not in the list has not been
        // hidden by anything; dropping it would lose a category nobody gated.
        const orphan = { id: "loose", parentId: "deleted", visibleAfterProductIds: [] as string[] };
        expect(visibleCategories([orphan], new Set()).map((c) => c.id)).toEqual(["loose"]);
    });
});

describe("whether the answer varies by reader at all", () => {
    it("says no when nothing is gated, so the list can still be shared", () => {
        expect(anyCategoryGated([open, { ...childOfGated, parentId: null }])).toBe(false);
    });

    it("says yes as soon as one category is gated", () => {
        expect(anyCategoryGated([open, gated])).toBe(true);
    });
});
