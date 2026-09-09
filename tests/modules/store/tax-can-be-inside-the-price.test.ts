/**
 * Tax on top of the price, or already inside it.
 *
 * The totals could only add tax on top, which is how a shop in one part of
 * the world quotes a price and is wrong in most of the rest: where a consumer
 * price is quoted tax-inclusive by law, adding it at checkout charges more
 * than the page said and puts the wrong figure on the invoice.
 *
 * Both modes have to produce the same three numbers for an invoice: what the
 * customer pays, what of that is tax, and what is left as net. The second is
 * the one that is easy to get wrong inclusive, because it is not a percentage
 * of the total - it is the total minus the total divided by one plus the rate.
 */
import { describe, it, expect } from "vitest";
import { computeTotals } from "@/modules/store/lib/pricing";

const noDiscount = { couponDiscount: 0, creatorDiscount: 0 };

describe("tax added on top", () => {
    it("adds the rate to the discounted amount", () => {
        const t = computeTotals({ subtotal: 100, ...noDiscount, taxRate: 20, taxIncluded: false });
        expect(t.taxableAmount).toBe(100);
        expect(t.tax).toBe(20);
        expect(t.total).toBe(120);
    });

    it("charges nothing extra at a rate of zero", () => {
        const t = computeTotals({ subtotal: 100, ...noDiscount, taxRate: 0, taxIncluded: false });
        expect(t.tax).toBe(0);
        expect(t.total).toBe(100);
    });
});

describe("tax already inside the price", () => {
    it("leaves the customer paying exactly what the page said", () => {
        const t = computeTotals({ subtotal: 120, ...noDiscount, taxRate: 20, taxIncluded: true });
        expect(t.total).toBe(120);
    });

    it("takes the tax out of the total rather than off the top of it", () => {
        // 20 percent of 120 is 24, and that is the wrong answer: the tax
        // inside a 120 gross at 20 percent is 20, leaving 100 net.
        const t = computeTotals({ subtotal: 120, ...noDiscount, taxRate: 20, taxIncluded: true });
        expect(t.tax).toBe(20);
        expect(t.taxableAmount).toBe(100);
    });

    it("still adds up to the penny on a rate that does not divide evenly", () => {
        const t = computeTotals({ subtotal: 99.99, ...noDiscount, taxRate: 18, taxIncluded: true });
        expect(t.taxableAmount + t.tax).toBe(t.total);
        expect(t.total).toBe(99.99);
    });

    it("charges nothing and calls nothing tax at a rate of zero", () => {
        const t = computeTotals({ subtotal: 100, ...noDiscount, taxRate: 0, taxIncluded: true });
        expect(t.tax).toBe(0);
        expect(t.taxableAmount).toBe(100);
        expect(t.total).toBe(100);
    });
});

describe("a discount, whichever way tax runs", () => {
    it("comes off before tax is added", () => {
        const t = computeTotals({ subtotal: 100, couponDiscount: 50, creatorDiscount: 0, taxRate: 20, taxIncluded: false });
        expect(t.total).toBe(60);
    });

    it("comes off the gross when tax is inside it", () => {
        const t = computeTotals({ subtotal: 120, couponDiscount: 60, creatorDiscount: 0, taxRate: 20, taxIncluded: true });
        expect(t.total).toBe(60);
        expect(t.tax).toBe(10);
        expect(t.taxableAmount).toBe(50);
    });
});
