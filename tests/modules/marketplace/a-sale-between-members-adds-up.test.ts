/**
 * One member selling to another, with the site taking a cut.
 *
 * Three numbers move and they have to be the same number: what the buyer pays,
 * what the seller receives, and what the site keeps. The way this goes wrong is
 * never dramatic - it is a rounding step run twice, so the three add up to one
 * credit more or less than the price, and a shop discovers months later that
 * its currency slowly leaks.
 *
 * So only one of them is calculated. The cut is worked out from the price and
 * the seller's share is whatever is left, never computed from a percentage of
 * its own. Two roundings of the same number cannot agree, and one of them has
 * to be the remainder.
 *
 * The rest is who may buy: not the seller, not somebody without the credits,
 * and not twice.
 */
import { describe, it, expect } from "vitest";
import { saleSplit, purchaseRefusal } from "@/modules/marketplace/lib/sale";

describe("splitting a sale three ways", () => {
    it("gives the site its cut and the seller the rest", () => {
        expect(saleSplit(100, 10)).toEqual({ price: 100, commission: 10, toSeller: 90 });
    });

    it("always adds back up to the price, whatever the rounding", () => {
        // 7% of 101 is 7.07. Rounding both sides independently is how a
        // currency leaks a credit at a time.
        for (const price of [1, 3, 7, 33, 99, 101, 1001, 12345]) {
            for (const percent of [1, 3, 7, 10, 33.5, 99]) {
                const split = saleSplit(price, percent);
                expect(split.commission + split.toSeller).toBe(price);
            }
        }
    });

    it("never gives the site more than the sale", () => {
        expect(saleSplit(100, 100)).toEqual({ price: 100, commission: 100, toSeller: 0 });
        expect(saleSplit(100, 150)).toEqual({ price: 100, commission: 100, toSeller: 0 });
    });

    it("takes nothing when the site takes no cut", () => {
        expect(saleSplit(100, 0)).toEqual({ price: 100, commission: 0, toSeller: 100 });
        expect(saleSplit(100, -5)).toEqual({ price: 100, commission: 0, toSeller: 100 });
    });

    it("rounds the cut down, so the seller is never short", () => {
        // 7% of 101 is 7.07: the site takes 7 and the seller has 94.
        expect(saleSplit(101, 7)).toEqual({ price: 101, commission: 7, toSeller: 94 });
    });
});

describe("who may buy a listing", () => {
    const listing = { id: "listing-1", sellerId: "seller-1", price: 100, isSold: false, isActive: true };
    const buy = (over: Record<string, unknown> = {}, balance = 500, buyerId = "buyer-1") =>
        purchaseRefusal({ ...listing, ...over }, buyerId, balance);

    it("is bought by somebody with the credits", () => {
        expect(buy()).toEqual({ buy: 100 });
    });

    it("is not bought by the person selling it", () => {
        // Nothing moves except the site's cut, which would come out of their
        // own balance: a way to burn credits that looks like a sale.
        expect(buy({}, 500, "seller-1")).toEqual({ refuse: "own-listing" });
    });

    it("is not bought without the credits", () => {
        expect(buy({}, 99)).toEqual({ refuse: "insufficient-balance" });
    });

    it("is bought at exactly the balance", () => {
        expect(buy({}, 100)).toEqual({ buy: 100 });
    });

    it("is not bought twice", () => {
        expect(buy({ isSold: true })).toEqual({ refuse: "already-sold" });
    });

    it("is not bought once the seller has withdrawn it", () => {
        expect(buy({ isActive: false })).toEqual({ refuse: "not-for-sale" });
    });

    it("is not bought when it is priced at nothing", () => {
        // A listing at zero is a giveaway, and a sale that moves no credits
        // has no seller to pay and no cut to take.
        expect(buy({ price: 0 })).toEqual({ refuse: "not-for-sale" });
        expect(buy({ price: -5 })).toEqual({ refuse: "not-for-sale" });
    });
});
