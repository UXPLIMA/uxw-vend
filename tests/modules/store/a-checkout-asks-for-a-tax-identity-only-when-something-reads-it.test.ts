/**
 * When the checkout asks for a tax identity, and when it does not.
 *
 * Most shops on this platform will never issue a legal invoice, and putting a
 * tax number and a tax office in front of every buyer is a longer checkout for
 * a field nobody reads. Most of the ones that do are legally obliged to, and
 * for them a missing tax number is a sale that cannot be invoiced after the
 * money has already moved.
 *
 * So the store asks, the same way it asks who can take money: nothing installed
 * answers, and the checkout is the one it always had. Something answers, and
 * the details become required - checked here rather than trusted from the
 * screen, because a form is a suggestion and a request is what arrives.
 *
 * The reply names every missing box at once and by name, so the screen can
 * mark them rather than saying "something is missing" over a page of fields.
 */
import { describe, it, expect } from "vitest";
import { billingRefusal } from "@/modules/store/lib/billing";

const complete = {
    kind: "company" as const,
    name: "Analytical Engines Ltd",
    taxNumber: "1234567890",
    taxOffice: "Kadikoy",
    address: "12 Analytical Street",
    city: "Istanbul",
    country: "TR",
};

describe("a shop with nothing issuing invoices", () => {
    it("asks for nothing, and stores nothing", () => {
        expect(billingRefusal(false, undefined)).toEqual({ billing: null });
    });

    it("still keeps details a buyer volunteered, because they meant them", () => {
        // The shop installs an invoicing module next month and the order it
        // already has is one it can invoice.
        expect(billingRefusal(false, complete)).toEqual({ billing: complete });
    });

    it("does not turn a half-filled form into a stored identity", () => {
        // Nothing required it, so nothing checked it. Half an address on an
        // order looks like an answer and is not one.
        expect(billingRefusal(false, { ...complete, city: "" })).toEqual({ billing: null });
    });
});

describe("a shop that issues invoices", () => {
    it("takes a complete identity", () => {
        expect(billingRefusal(true, complete)).toEqual({ billing: complete });
    });

    it("refuses when the buyer sent none at all", () => {
        expect(billingRefusal(true, undefined)).toEqual({ missing: ["name", "address", "city", "country"] });
    });

    it("names every missing box at once", () => {
        expect(billingRefusal(true, { ...complete, taxNumber: "", city: "" }))
            .toEqual({ missing: ["city", "taxNumber"] });
    });

    it("stores what it takes, tidied up", () => {
        const answer = billingRefusal(true, { ...complete, taxNumber: "123 456 7890", country: "tr" });
        expect(answer).toEqual({
            billing: { ...complete, taxNumber: "1234567890", country: "TR" },
        });
    });
});
