/**
 * One way to put credits into an account, for anything that needs to.
 *
 * Cashback is the first, and it will not be the last: a forum that rewards a
 * first post, a vote that pays for itself, a referral that pays out. Left to
 * themselves each of those writes its own balance increment and its own ledger
 * row, and the first one to forget the transaction leaves a balance nothing
 * accounts for - which is the single thing a credit history exists to prevent.
 *
 * So there is one door, and what a caller has to bring is a key. The award is
 * written with an id derived from it, so the second attempt is a duplicate
 * primary key rather than a second award. Every one of these triggers fires
 * more than once in normal operation: a retried callback, a job that ran
 * twice, an operator repeating something by hand.
 *
 * A key that is not unique is worse than no key at all - it silently swallows
 * a real second award - so the caller names both what happened and which one
 * it was, and this refuses anything vaguer.
 */
import { describe, it, expect } from "vitest";
import { awardLedgerId, awardRefusal } from "@/modules/credits/lib/award";

const ask = (over: Partial<Parameters<typeof awardRefusal>[0]> = {}) =>
    awardRefusal({ userId: "member-1", amount: 10, reason: "cashback", key: "order-1", ...over });

describe("what an award has to bring", () => {
    it("is accepted with a member, an amount and a key", () => {
        expect(ask()).toEqual({ award: 10 });
    });

    it("is refused without a member", () => {
        expect(ask({ userId: "" })).toEqual({ refuse: "no-member" });
        expect(ask({ userId: "   " })).toEqual({ refuse: "no-member" });
    });

    it("is refused without a reason, because the history is the point", () => {
        // A row that says a balance went up and not why is the thing this
        // ledger exists to avoid.
        expect(ask({ reason: "" })).toEqual({ refuse: "no-reason" });
    });

    it("is refused without a key, because then it cannot happen once", () => {
        expect(ask({ key: "" })).toEqual({ refuse: "no-key" });
    });
});

describe("how much an award may be", () => {
    it("is refused for nothing", () => {
        expect(ask({ amount: 0 })).toEqual({ refuse: "amount-not-positive" });
    });

    it("is refused for a negative amount, which is a deduction wearing a reward's name", () => {
        expect(ask({ amount: -10 })).toEqual({ refuse: "amount-not-positive" });
    });

    it("is refused for a fraction, because a balance is a count", () => {
        expect(ask({ amount: 2.5 })).toEqual({ refuse: "amount-not-positive" });
    });

    it("is refused for a number that is not one", () => {
        expect(ask({ amount: Number.NaN })).toEqual({ refuse: "amount-not-positive" });
        expect(ask({ amount: Number.POSITIVE_INFINITY })).toEqual({ refuse: "amount-not-positive" });
    });
});

describe("the id that makes an award happen once", () => {
    it("is the same for the same reason and key", () => {
        expect(awardLedgerId("cashback", "order-1")).toBe(awardLedgerId("cashback", "order-1"));
    });

    it("is different for a different key", () => {
        expect(awardLedgerId("cashback", "order-1")).not.toBe(awardLedgerId("cashback", "order-2"));
    });

    it("is different for a different reason on the same thing", () => {
        // An order can earn cashback and settle a referral. Both name the
        // order; only the pair says which award it is.
        expect(awardLedgerId("cashback", "order-1")).not.toBe(awardLedgerId("referral", "order-1"));
    });

    it("cannot be confused by a key that contains the separator", () => {
        // "a" + "b:c" and "a:b" + "c" must not collide, or one module's award
        // silently swallows another's.
        expect(awardLedgerId("a", "b:c")).not.toBe(awardLedgerId("a:b", "c"));
    });

    it("fits a database key, whatever length it was given", () => {
        const long = awardLedgerId("cashback", "x".repeat(5000));
        expect(long.length).toBeLessThanOrEqual(64);
    });
});
