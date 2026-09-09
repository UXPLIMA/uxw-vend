/**
 * The rate between two currencies, from rates quoted against one base.
 *
 * Every rate on file says how many of a currency make one of the base. Asking
 * "how many lira per euro" means going through the base, and the direction is
 * the thing that gets inverted by accident: dividing the wrong way at 39 to
 * the dollar charges a buyer a thirtieth of the price, and the order is still
 * marked paid.
 *
 * Refusing is a real answer here. A payment that cannot start leaves the order
 * unpaid and somebody can fix the rate; an undercharge is money gone, so a
 * currency nobody has a rate for gets null rather than a guess of one.
 */
import { describe, it, expect } from "vitest";
import { crossRate } from "@/modules/currency/lib/rates";

// How many of each make one of the base.
const rates = new Map([["USD", 1], ["EUR", 0.92], ["TRY", 39.5]]);

describe("the rate between two currencies", () => {
    it("is one when they are the same currency", () => {
        expect(crossRate("TRY", "TRY", rates)).toBe(1);
    });

    it("is the target's own rate when starting from the base", () => {
        expect(crossRate("USD", "TRY", rates)).toBe(39.5);
    });

    it("inverts when ending at the base", () => {
        expect(crossRate("TRY", "USD", rates)).toBeCloseTo(1 / 39.5, 10);
    });

    it("goes through the base between two others", () => {
        // 39.5 lira per dollar, 0.92 euro per dollar, so 42.93 lira per euro.
        expect(crossRate("EUR", "TRY", rates)).toBeCloseTo(39.5 / 0.92, 10);
    });

    it("reads the codes whichever way they are typed", () => {
        expect(crossRate("try", "usd", rates)).toBeCloseTo(1 / 39.5, 10);
    });

    it("refuses a currency nobody has a rate for", () => {
        expect(crossRate("USD", "XYZ", rates)).toBeNull();
        expect(crossRate("XYZ", "USD", rates)).toBeNull();
    });

    it("refuses a rate that is zero, negative or not a number", () => {
        // Any of them divides into nonsense, and nonsense here is a charge.
        const broken = new Map([["USD", 1], ["AAA", 0], ["BBB", -3], ["CCC", Number.NaN]]);
        expect(crossRate("USD", "AAA", broken)).toBeNull();
        expect(crossRate("USD", "BBB", broken)).toBeNull();
        expect(crossRate("USD", "CCC", broken)).toBeNull();
        expect(crossRate("AAA", "USD", broken)).toBeNull();
    });
});
