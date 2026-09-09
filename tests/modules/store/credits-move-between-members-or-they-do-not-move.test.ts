/**
 * One member sending credits to another.
 *
 * This is the only path on the site where a balance leaves one account and
 * arrives in a different one, on nobody's authority but the sender's. Every
 * way it can be wrong is a way of making credits appear or disappear, so the
 * refusals are decided in one place and each of them is here.
 *
 * The two that look harmless and are not:
 *
 * - a negative amount. Read as a transfer it is a withdrawal from the
 *   recipient, made by somebody with no claim on their balance at all;
 * - sending to yourself. Nothing moves, but two ledger rows appear saying it
 *   did, which is exactly the shape somebody uses to make a balance look
 *   earned.
 *
 * The balance itself is checked here and again in the write, because a check
 * before a transaction is a snapshot: two sends of the whole balance,
 * arriving together, both pass a check that reads the same number.
 */
import { describe, it, expect } from "vitest";
import { transferRefusal } from "@/modules/store/lib/credit-transfer";

const send = (over: Partial<Parameters<typeof transferRefusal>[0]> = {}) =>
    transferRefusal({
        fromUserId: "member-1",
        toUserId: "member-2",
        amount: 100,
        balance: 500,
        ...over,
    });

describe("a transfer that should go through", () => {
    it("is allowed when the sender has the credits", () => {
        expect(send()).toEqual({ send: 100 });
    });

    it("is allowed for the whole balance", () => {
        expect(send({ amount: 500 })).toEqual({ send: 500 });
    });
});

describe("a transfer that would make credits appear", () => {
    it("is refused when the sender does not have them", () => {
        expect(send({ amount: 501 })).toEqual({ refuse: "insufficient-balance" });
    });

    it("is refused for a negative amount", () => {
        // Read as a transfer this takes credits from the recipient, on the
        // authority of somebody with no claim on their balance.
        expect(send({ amount: -100 })).toEqual({ refuse: "amount-not-positive" });
    });

    it("is refused for nothing at all", () => {
        expect(send({ amount: 0 })).toEqual({ refuse: "amount-not-positive" });
    });

    it("is refused for a fraction, because a balance is a count", () => {
        expect(send({ amount: 0.5 })).toEqual({ refuse: "amount-not-positive" });
    });

    it("is refused for a number that is not one", () => {
        expect(send({ amount: Number.NaN })).toEqual({ refuse: "amount-not-positive" });
        expect(send({ amount: Number.POSITIVE_INFINITY })).toEqual({ refuse: "amount-not-positive" });
    });
});

describe("a transfer to nowhere", () => {
    it("is refused when it is to the sender", () => {
        // Nothing moves and two ledger rows say it did.
        expect(send({ toUserId: "member-1" })).toEqual({ refuse: "same-account" });
    });

    it("is refused when there is no recipient", () => {
        expect(send({ toUserId: "" })).toEqual({ refuse: "no-recipient" });
        expect(send({ toUserId: "   " })).toEqual({ refuse: "no-recipient" });
    });
});

describe("the order the refusals are given in", () => {
    it("names the recipient before the amount, because that is the box they are on", () => {
        // Both wrong: the screen marks the field they are looking at.
        expect(send({ toUserId: "member-1", amount: -5 })).toEqual({ refuse: "same-account" });
    });

    it("names a bad amount before a balance it could never satisfy", () => {
        expect(send({ amount: -5, balance: 0 })).toEqual({ refuse: "amount-not-positive" });
    });
});
