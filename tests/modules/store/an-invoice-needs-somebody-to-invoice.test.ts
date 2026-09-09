/**
 * Who the invoice is made out to.
 *
 * The shop knew who bought something - an account, an email - and nothing a
 * tax authority would accept. No legal name, no tax number, no address. That
 * is fine until somebody has to issue a real invoice, at which point the money
 * has already been taken and the details that were never asked for cannot be
 * asked for any more.
 *
 * Two decisions are worth pinning down before any of it is stored.
 *
 * The first is who is asked. A shop with nothing issuing invoices must not put
 * a tax number in front of every buyer: it is a longer checkout for a field
 * nobody will ever read. So the store asks whether anything needs them, the
 * same way it asks who can take money, and a shop that answers nothing carries
 * on with the checkout it had.
 *
 * The second is what is asked of whom. A company has a tax number and a tax
 * office; a person has neither, and a form that demands them of a person
 * cannot be filled in at all. Leaving them optional for a company is the
 * mirror failure and the more expensive one: the checkout succeeds, the money
 * moves, and the invoice is rejected afterwards.
 */
import { describe, it, expect } from "vitest";
import { missingBillingFields, normaliseBilling } from "@/modules/store/lib/billing";

const person = {
    kind: "individual" as const,
    name: "Ada Lovelace",
    taxNumber: "",
    taxOffice: "",
    address: "12 Analytical Street",
    city: "London",
    country: "GB",
};

const company = {
    kind: "company" as const,
    name: "Analytical Engines Ltd",
    taxNumber: "1234567890",
    taxOffice: "Kadikoy",
    address: "12 Analytical Street",
    city: "Istanbul",
    country: "TR",
};

describe("what a person has to give", () => {
    it("is asked for nothing a person does not have", () => {
        expect(missingBillingFields(person)).toEqual([]);
    });

    it("still has to say who they are and where they are", () => {
        expect(missingBillingFields({ ...person, name: "" })).toEqual(["name"]);
        expect(missingBillingFields({ ...person, address: "" })).toEqual(["address"]);
        expect(missingBillingFields({ ...person, city: "" })).toEqual(["city"]);
        expect(missingBillingFields({ ...person, country: "" })).toEqual(["country"]);
    });

    it("names every empty box at once, in the order they appear", () => {
        // One at a time is a form somebody fills in four times.
        expect(missingBillingFields({ ...person, name: "", city: "" })).toEqual(["name", "city"]);
    });
});

describe("what a company has to give", () => {
    it("is complete when it has both of the things a person does not", () => {
        expect(missingBillingFields(company)).toEqual([]);
    });

    it("cannot leave out its tax number or its tax office", () => {
        // The expensive direction: optional here means the checkout succeeds,
        // the money moves, and the invoice is refused afterwards.
        expect(missingBillingFields({ ...company, taxNumber: "" })).toEqual(["taxNumber"]);
        expect(missingBillingFields({ ...company, taxOffice: "" })).toEqual(["taxOffice"]);
    });
});

describe("reading what was typed", () => {
    it("treats a box of spaces as an empty box", () => {
        expect(missingBillingFields({ ...person, name: "   " })).toEqual(["name"]);
    });

    it("takes a tax number however it was spaced out", () => {
        // People copy it off a document with the grouping still in it.
        expect(normaliseBilling({ ...company, taxNumber: "123 456 7890" }).taxNumber).toBe("1234567890");
        expect(normaliseBilling({ ...company, taxNumber: "1234-567-890" }).taxNumber).toBe("1234567890");
    });

    it("keeps the country as a code, because that is what a provider reads", () => {
        expect(normaliseBilling({ ...person, country: "gb" }).country).toBe("GB");
    });

    it("refuses a country somebody typed the long way", () => {
        // "Turkey" is not a country to anything downstream, and storing it
        // means an invoice refused long after the sale.
        expect(missingBillingFields({ ...person, country: "Turkey" })).toEqual(["country"]);
    });

    it("forgets what a person cannot have, rather than storing an empty string", () => {
        const stored = normaliseBilling({ ...person, taxOffice: "left over from switching kind" });
        expect(stored.taxOffice).toBe("");
        expect(stored.taxNumber).toBe("");
    });

    it("trims the rest without changing it", () => {
        expect(normaliseBilling({ ...person, name: "  Ada Lovelace  " }).name).toBe("Ada Lovelace");
    });
});
