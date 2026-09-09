/**
 * A way to pay that takes no money, and the two ways it goes wrong.
 *
 * Every other gateway here talks to a processor: the buyer is sent away, the
 * money moves, a callback says so. Some sales never work like that. A bank
 * transfer, an office that takes cash, an invoice settled thirty days later -
 * the shop still needs the order, and somebody confirms it by hand when the
 * money turns up.
 *
 * The first failure is offering it when nobody has said how to pay. The
 * gateway has no credentials to be missing, so "configured" cannot mean what
 * it means for the others: what it means here is that an operator has written
 * the instructions. Without them the buyer picks a payment method, is sent to
 * a page, and the page has nothing on it. So a blank instruction is not a
 * gateway, and it is not offered.
 *
 * The second is currency. An operator who banks in one currency and prices in
 * another cannot take a transfer in the second, and the choice belongs to
 * them rather than to this file: an empty list means they take whatever the
 * shop prices in.
 */
import { describe, it, expect } from "vitest";
import {
    offersManualPayment,
    acceptedCurrencies,
} from "@/modules/manual-payment-gateway/lib/manual-payment";

describe("whether to offer paying by hand", () => {
    it("offers it once an operator has written how to pay", () => {
        expect(offersManualPayment({ instructions: "Send it to TR00 0000", currencies: [] }, "USD")).toBe(true);
    });

    it("stays out of the way until they have", () => {
        // Nothing to be missing but the words themselves. Offered blank, the
        // buyer reaches a page that tells them nothing and an order nobody
        // will ever pay.
        expect(offersManualPayment({ instructions: "", currencies: [] }, "USD")).toBe(false);
        expect(offersManualPayment({ instructions: "   \n  ", currencies: [] }, "USD")).toBe(false);
    });

    it("takes whatever the shop prices in when no currency was named", () => {
        const set = { instructions: "Send it to TR00 0000", currencies: [] };
        expect(offersManualPayment(set, "USD")).toBe(true);
        expect(offersManualPayment(set, "TRY")).toBe(true);
    });

    it("takes only the currencies the operator banks in, once they say", () => {
        const set = { instructions: "Send it to TR00 0000", currencies: ["TRY", "EUR"] };
        expect(offersManualPayment(set, "TRY")).toBe(true);
        expect(offersManualPayment(set, "EUR")).toBe(true);
        expect(offersManualPayment(set, "USD")).toBe(false);
    });

    it("reads the currency the buyer is in whatever case it arrives in", () => {
        const set = { instructions: "Send it to TR00 0000", currencies: ["TRY"] };
        expect(offersManualPayment(set, "try")).toBe(true);
    });
});

describe("reading the currencies an operator typed", () => {
    it("takes a comma separated line", () => {
        expect(acceptedCurrencies("TRY, EUR")).toEqual(["TRY", "EUR"]);
    });

    it("takes what they actually type, which is any of the separators", () => {
        expect(acceptedCurrencies("try eur")).toEqual(["TRY", "EUR"]);
        expect(acceptedCurrencies("TRY;EUR")).toEqual(["TRY", "EUR"]);
        expect(acceptedCurrencies("TRY\nEUR")).toEqual(["TRY", "EUR"]);
    });

    it("means every currency by an empty box, not none of them", () => {
        // The difference decides whether the gateway works at all, and an
        // operator who leaves it alone means "I do not mind".
        expect(acceptedCurrencies("")).toEqual([]);
        expect(acceptedCurrencies(null)).toEqual([]);
        expect(acceptedCurrencies("  ")).toEqual([]);
    });

    it("drops anything that is not a currency code", () => {
        expect(acceptedCurrencies("TRY, dollars, EU, EURO")).toEqual(["TRY"]);
    });

    it("says each one once", () => {
        expect(acceptedCurrencies("TRY, try, TRY")).toEqual(["TRY"]);
    });
});
