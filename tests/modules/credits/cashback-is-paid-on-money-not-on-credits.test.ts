/**
 * Giving a percentage of a purchase back as credits.
 *
 * The rule is one line and the way it goes wrong is not. Credits can be spent
 * in the shop, so an order paid with credits that earns credits is a loop:
 * spend a hundred, get five back, spend those, get more. Nothing in the ledger
 * looks wrong at any single step - each row is a real award for a real order -
 * and the balance climbs on its own. So cashback is paid on money that
 * arrived, and an order settled from the wallet earns nothing.
 *
 * The other decisions are small and worth fixing rather than leaving to
 * whoever reads the code next: a balance is a whole number, so a percentage of
 * a small order is either rounded down to nothing or up to one, and which one
 * it is decides whether a shop selling cheap things has a cashback scheme at
 * all. It rounds down, because a scheme that pays a credit on every one-lira
 * sale is a scheme somebody will farm.
 *
 * And it happens once. An order completing twice - a retried callback, an
 * operator marking an order paid that a webhook was already settling - is
 * normal, and a second award is credits from nowhere.
 */
import { describe, it, expect } from "vitest";
import { cashbackFor } from "@/modules/credits/lib/cashback";

const paid = {
    total: 200,
    paymentMethod: "stripe",
};

describe("what a purchase earns", () => {
    it("is the percentage the operator set", () => {
        expect(cashbackFor(paid, 5)).toEqual({ award: 10 });
    });

    it("is nothing when the operator set no rate", () => {
        expect(cashbackFor(paid, 0)).toEqual({ skip: "no-rate" });
    });

    it("is nothing when the rate is not a number", () => {
        expect(cashbackFor(paid, Number.NaN)).toEqual({ skip: "no-rate" });
        expect(cashbackFor(paid, -5)).toEqual({ skip: "no-rate" });
    });
});

describe("an order paid from the wallet", () => {
    it("earns nothing, because that is a loop", () => {
        // Spend a hundred, get five back, spend those. Every row in the
        // ledger is a real award for a real order and the balance climbs on
        // its own.
        expect(cashbackFor({ ...paid, paymentMethod: "credits" }, 5)).toEqual({ skip: "paid-with-credits" });
    });

    it("earns nothing however the method is spelled", () => {
        expect(cashbackFor({ ...paid, paymentMethod: "CREDITS" }, 5)).toEqual({ skip: "paid-with-credits" });
    });
});

describe("a percentage that is not a whole credit", () => {
    it("rounds down, so a one-lira sale earns nothing", () => {
        // Rounding up pays a credit on every trivial sale, which is a scheme
        // somebody will farm rather than a reward for spending.
        expect(cashbackFor({ ...paid, total: 19.9 }, 5)).toEqual({ skip: "rounds-to-nothing" });
        expect(cashbackFor({ ...paid, total: 1 }, 5)).toEqual({ skip: "rounds-to-nothing" });
    });

    it("pays the whole credits it does earn", () => {
        // 5% of 59.90 is 2.995.
        expect(cashbackFor({ ...paid, total: 59.9 }, 5)).toEqual({ award: 2 });
    });
});

describe("an order that is not a sale", () => {
    it("earns nothing when it was free", () => {
        expect(cashbackFor({ ...paid, total: 0 }, 5)).toEqual({ skip: "nothing-paid" });
    });

    it("earns nothing on a total that is not a number", () => {
        expect(cashbackFor({ ...paid, total: Number.NaN }, 5)).toEqual({ skip: "nothing-paid" });
        expect(cashbackFor({ ...paid, total: -50 }, 5)).toEqual({ skip: "nothing-paid" });
    });

    it("earns nothing when nobody recorded how it was paid", () => {
        // An order with no method is one this shop cannot say was paid with
        // money, and guessing in the earning direction is the expensive way
        // to be wrong.
        expect(cashbackFor({ ...paid, paymentMethod: null }, 5)).toEqual({ skip: "paid-with-credits" });
    });
});
