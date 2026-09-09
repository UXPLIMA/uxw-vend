/**
 * A gateway that only settles in its own currency.
 *
 * A shop can price in one currency and take money through a processor that
 * only holds another. Handing that processor the shop's number with its own
 * currency code attached is the failure that looks like it worked: 100 USD
 * becomes 100 TRY, the buyer pays a thirtieth of the price, and the order is
 * marked paid.
 *
 * So the amount is converted, and the conversion refuses rather than guesses.
 * A missing rate means a payment that cannot be started, not a payment for the
 * wrong amount: the order stays unpaid and somebody can fix the rate, which is
 * recoverable in a way an undercharge is not.
 */
import { describe, it, expect } from "vitest";
import { convertedCharge } from "@/modules/store/lib/currency";

describe("charging in the gateway's own currency", () => {
    it("converts at the rate it is given", () => {
        expect(convertedCharge(100, 39.5)).toBe(3950);
    });

    it("rounds to the currency's smallest unit", () => {
        expect(convertedCharge(9.99, 1.0834)).toBe(10.82);
    });

    it("refuses a rate that is missing", () => {
        expect(convertedCharge(100, null)).toBeNull();
    });

    it("refuses a rate that is zero or negative", () => {
        // Both would hand a processor an amount of nothing, or less.
        expect(convertedCharge(100, 0)).toBeNull();
        expect(convertedCharge(100, -1)).toBeNull();
    });

    it("refuses a rate that is not a number at all", () => {
        expect(convertedCharge(100, Number.NaN)).toBeNull();
        expect(convertedCharge(100, Number.POSITIVE_INFINITY)).toBeNull();
    });

    it("charges nothing for nothing, without needing a rate", () => {
        expect(convertedCharge(0, null)).toBe(0);
    });
});
