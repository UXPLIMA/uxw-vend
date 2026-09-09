/**
 * A product that cannot be bought until something else has been.
 *
 * Every upgrade path a shop sells has this shape: the tier above is only for
 * people already on the tier below, the add-on only makes sense with the thing
 * it adds to, the renewal is only for somebody who has the original. Without
 * it an operator can only describe the rule in the product's own description
 * and then refund the people who did not read it.
 *
 * Two shapes cover what shops actually ask for: own all of a list, or own at
 * least one of it. The second is how "any of our three memberships" is said.
 *
 * Where it sits in the order of refusals matters as much as the rule. It comes
 * before the clock: telling somebody the sale opens on Friday, when they also
 * cannot buy it at all, wastes their Friday. It comes after the rank, because
 * a rank is the one refusal they cannot act on and it should be said first.
 */
import { describe, it, expect } from "vitest";
import { availabilityOf, type ProductRules } from "@/modules/store/lib/availability";

const NOW = new Date("2026-09-09T12:00:00Z");

const open: ProductRules = {
    isActive: true,
    roleIds: [],
    requiresProductIds: [],
    requiresAny: false,
    availableFrom: null,
    availableUntil: null,
    availableDays: [],
    availableFromMinute: null,
    availableUntilMinute: null,
    outsideWindow: "countdown",
    perPersonLimit: null,
    perPersonPeriod: "ever",
    periodStock: null,
    periodStockWindow: "day",
    stock: null,
    price: 10,
    salePrice: null,
    saleFrom: null,
    saleUntil: null,
};

const counts = (owned: string[] = []) => ({
    boughtByPerson: 0,
    soldInPeriod: 0,
    ownedProductIds: new Set(owned),
});

describe("a product that needs another one first", () => {
    it("is open to somebody who owns what it asks for", () => {
        const rules = { ...open, requiresProductIds: ["vip"] };
        expect(availabilityOf(rules, counts(["vip"]), NOW, "UTC").state).toBe("open");
    });

    it("is refused to somebody who owns none of it", () => {
        const rules = { ...open, requiresProductIds: ["vip"] };
        const answer = availabilityOf(rules, counts([]), NOW, "UTC");
        expect(answer.state).toBe("needs_product");
        expect(answer.buyable).toBe(false);
    });

    it("wants all of the list by default", () => {
        const rules = { ...open, requiresProductIds: ["vip", "key"] };
        expect(availabilityOf(rules, counts(["vip"]), NOW, "UTC").state).toBe("needs_product");
        expect(availabilityOf(rules, counts(["vip", "key"]), NOW, "UTC").state).toBe("open");
    });

    it("wants any one of the list when the operator says so", () => {
        const rules = { ...open, requiresProductIds: ["vip", "key"], requiresAny: true };
        expect(availabilityOf(rules, counts(["key"]), NOW, "UTC").state).toBe("open");
        expect(availabilityOf(rules, counts([]), NOW, "UTC").state).toBe("needs_product");
    });

    it("asks for nothing when the list is empty, whichever way the switch is set", () => {
        expect(availabilityOf(open, counts([]), NOW, "UTC").state).toBe("open");
        expect(availabilityOf({ ...open, requiresAny: true }, counts([]), NOW, "UTC").state).toBe("open");
    });

    it("says the rank first, because that is the one they cannot act on", () => {
        const rules = { ...open, roleIds: ["vip-rank"], requiresProductIds: ["vip"] };
        expect(availabilityOf(rules, counts([]), NOW, "UTC").state).toBe("wrong_role");
    });

    it("says it before the clock, so nobody waits for a sale they cannot buy", () => {
        const rules = {
            ...open,
            requiresProductIds: ["vip"],
            availableFrom: new Date("2026-09-11T18:00:00Z"),
        };
        expect(availabilityOf(rules, counts([]), NOW, "UTC").state).toBe("needs_product");
    });
});
