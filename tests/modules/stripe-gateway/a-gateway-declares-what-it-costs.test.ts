/**
 * A gateway offering to pass its fee on says what the fee is.
 *
 * The store does not know what any gateway charges, and should not: a gateway
 * is the only thing that knows its own rates. So the offer travels with the
 * provider, in the descriptor the checkout page already reads, and a gateway
 * that does not offer the choice simply leaves it out.
 *
 * Switched off is the same as absent. A rate typed while the switch is off is
 * a rate nobody chose to charge, and reporting it would have the store gross
 * up an order the operator never agreed to.
 */
import { describe, it, expect } from "vitest";
import { passOnFeeFrom } from "@/modules/stripe-gateway/lib/fee";

describe("what a gateway declares about its fee", () => {
    it("declares nothing while the switch is off", () => {
        expect(passOnFeeFrom({ pass: false, percent: 2.9, fixed: 0.25 })).toBeUndefined();
    });

    it("declares the rate once the switch is on", () => {
        expect(passOnFeeFrom({ pass: true, percent: 2.9, fixed: 0.25 })).toEqual({
            percent: 2.9,
            fixed: 0.25,
        });
    });

    it("declares nothing when the switch is on and both numbers are zero", () => {
        // Nothing to pass on is not a fee of nothing; it is no offer at all,
        // and the store should not add a line reading "0.00".
        expect(passOnFeeFrom({ pass: true, percent: 0, fixed: 0 })).toBeUndefined();
    });

    it("reads a missing or unreadable number as zero", () => {
        expect(passOnFeeFrom({ pass: true, percent: NaN, fixed: 0.25 })).toEqual({
            percent: 0,
            fixed: 0.25,
        });
        expect(passOnFeeFrom({ pass: true, percent: 2.9, fixed: NaN })).toEqual({
            percent: 2.9,
            fixed: 0,
        });
    });
});
