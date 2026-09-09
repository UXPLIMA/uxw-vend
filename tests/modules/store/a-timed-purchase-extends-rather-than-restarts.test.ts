/**
 * Buying a timed product again adds to what is left, rather than replacing it.
 *
 * A rank sold for thirty days is the shape every shop that sells access
 * eventually wants, and the whole feature turns on one rule nobody notices
 * until it is wrong: what happens when somebody who already has twenty days
 * left buys another thirty. Replacing the date takes ten days off a paying
 * customer, silently, and they find out a week later.
 *
 * So the rule is written down here before the column exists: a purchase that
 * lands while the old one is still running extends it; one that lands after it
 * has lapsed starts again from the moment of purchase, not from the stale end
 * date - otherwise a customer returning after a year buys thirty days that
 * expired eleven months ago.
 */
import { describe, it, expect } from "vitest";
import { extendedExpiry } from "@/modules/store/lib/ownership";

const AT = new Date("2026-09-09T12:00:00Z");
const days = (n: number) => n * 86_400_000;

describe("when a timed product is bought", () => {
    it("runs from the moment of purchase, the first time", () => {
        expect(extendedExpiry(null, 30, AT)).toEqual(new Date(AT.getTime() + days(30)));
    });

    it("adds to what is left, when it is bought again in time", () => {
        const twentyLeft = new Date(AT.getTime() + days(20));
        expect(extendedExpiry(twentyLeft, 30, AT)).toEqual(new Date(AT.getTime() + days(50)));
    });

    it("starts again from now, when the old one has already lapsed", () => {
        const lapsedLastYear = new Date(AT.getTime() - days(365));
        expect(extendedExpiry(lapsedLastYear, 30, AT)).toEqual(new Date(AT.getTime() + days(30)));
    });

    it("stays forever once something was bought without a duration", () => {
        // A product with no duration is owned outright. Buying a timed one
        // afterwards must not put an end date on something that had none.
        expect(extendedExpiry(null, null, AT)).toBeNull();
        expect(extendedExpiry(new Date(AT.getTime() + days(5)), null, AT)).toBeNull();
    });

    it("refuses a duration that is not a positive whole number of days", () => {
        // The admin form is a number input and a person types in it.
        expect(extendedExpiry(null, 0, AT)).toBeNull();
        expect(extendedExpiry(null, -5, AT)).toBeNull();
        expect(extendedExpiry(null, 1.5, AT)).toEqual(new Date(AT.getTime() + days(1)));
    });
});
