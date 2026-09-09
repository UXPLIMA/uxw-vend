/**
 * What the product form sends about a prerequisite.
 *
 * The picker offers every product in the shop, which includes the one being
 * edited. Choosing it would make the product require itself: unbuyable by
 * anybody, for ever, with nothing on screen saying why. The API drops it too -
 * that is the half that holds against a direct call - and this is the half
 * that stops the form offering the trap in the first place.
 *
 * The switch only means anything when the list has more than one entry, and
 * an empty list asks for nothing whichever way it is set.
 */
import { describe, it, expect } from "vitest";
import {
    requirementPayload,
    EMPTY_REQUIREMENT,
    choosableProducts,
} from "@/modules/store/pages/admin/products/_fields/requirement-payload";

describe("what the form sends about prerequisites", () => {
    it("sends an empty list and the default switch when nothing is chosen", () => {
        expect(requirementPayload(EMPTY_REQUIREMENT)).toEqual({
            requiresProductIds: [],
            requiresAny: false,
        });
    });

    it("sends the chosen ids and the switch", () => {
        expect(
            requirementPayload({ requiresProductIds: ["a", "b"], requiresAny: true }),
        ).toEqual({ requiresProductIds: ["a", "b"], requiresAny: true });
    });
});

describe("what the picker offers", () => {
    const shop = [{ id: "a", name: "VIP" }, { id: "b", name: "VIP+" }];

    it("offers every other product", () => {
        expect(choosableProducts(shop, "b")).toEqual([{ id: "a", name: "VIP" }]);
    });

    it("offers all of them while the product does not exist yet", () => {
        expect(choosableProducts(shop, undefined)).toEqual(shop);
    });
});
