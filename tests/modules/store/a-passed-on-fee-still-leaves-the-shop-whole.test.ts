/**
 * Passing the processor's fee to the customer, and actually being left whole.
 *
 * The obvious way is to add the percentage to the total, and it is wrong: the
 * processor takes its cut of the larger amount too, so a shop that adds 2.9
 * per cent to a 100 charge is paid 102.90 and keeps 99.92. The gap is small
 * per order and exactly the size of the fee it was trying not to pay.
 *
 * The right shape divides rather than multiplies - what has to be charged so
 * that what is left after the cut is the figure the shop wanted. The fixed
 * part goes inside that division, because the processor takes its percentage
 * of the whole charge including the part covering its own fixed fee.
 */
import { describe, it, expect } from "vitest";
import { grossUpForFee } from "@/modules/store/lib/pricing";

describe("what the customer is charged", () => {
    it("is the total itself when there is no fee to pass on", () => {
        expect(grossUpForFee(100, { percent: 0, fixed: 0 })).toEqual({ charged: 100, surcharge: 0 });
    });

    it("adds a fixed fee as it is", () => {
        expect(grossUpForFee(100, { percent: 0, fixed: 0.25 })).toEqual({ charged: 100.25, surcharge: 0.25 });
    });

    it("divides rather than multiplies for a percentage", () => {
        // Adding 2.9 percent would charge 102.90 and leave 99.92. Dividing
        // charges 102.99, of which the processor takes 2.99, leaving 100.
        const { charged } = grossUpForFee(100, { percent: 2.9, fixed: 0 });
        expect(charged).toBe(102.99);
        expect(Math.round((charged - charged * 0.029) * 100) / 100).toBe(100);
    });

    it("puts the fixed part inside the division, not after it", () => {
        // The processor takes its percentage of the whole charge, including
        // the part covering its own fixed fee.
        const { charged } = grossUpForFee(100, { percent: 2.9, fixed: 0.25 });
        expect(charged).toBe(103.24);
        const kept = charged - charged * 0.029 - 0.25;
        expect(Math.round(kept * 100) / 100).toBe(100);
    });

    it("reports the surcharge, so a buyer can be shown what was added", () => {
        const { charged, surcharge } = grossUpForFee(100, { percent: 2.9, fixed: 0.25 });
        expect(surcharge).toBe(3.24);
        expect(charged - surcharge).toBe(100);
    });

    it("charges nothing extra on nothing", () => {
        expect(grossUpForFee(0, { percent: 2.9, fixed: 0.25 })).toEqual({ charged: 0, surcharge: 0 });
    });

    it("treats a rate that would eat the whole payment as a typo, not a fee", () => {
        // 100 per cent divides by zero and anything above it goes negative.
        // A number an operator typed must not produce an infinite charge.
        expect(grossUpForFee(100, { percent: 100, fixed: 0 })).toEqual({ charged: 100, surcharge: 0 });
        expect(grossUpForFee(100, { percent: 150, fixed: 0 })).toEqual({ charged: 100, surcharge: 0 });
        expect(grossUpForFee(100, { percent: -5, fixed: 0 })).toEqual({ charged: 100, surcharge: 0 });
    });
});
