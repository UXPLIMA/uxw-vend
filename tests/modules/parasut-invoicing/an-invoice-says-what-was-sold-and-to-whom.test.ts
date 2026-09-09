/**
 * Turning one paid order into the two documents an accounting service wants.
 *
 * The service keeps customers and invoices separately: an invoice points at a
 * contact, so a first sale to somebody creates the contact and every sale
 * after it reuses it. Both are sent in the JSON:API shape - a `data` object
 * with a `type`, its `attributes`, and `relationships` to the rows it points
 * at - which is easy to get subtly wrong and impossible to check afterwards,
 * because a rejected invoice comes back as a validation error long after the
 * money moved.
 *
 * The decisions worth pinning are the ones a reader would get wrong:
 *
 * - a person and a company are different kinds of contact, and only one of
 *   them has a tax office. Sending an empty one for a person is a field the
 *   service will not take;
 * - the service spells the Turkish lira `TRL`, not the ISO code the shop
 *   prices in. Sending `TRY` is an invoice in a currency it does not know;
 * - the tax on a line is a rate, not an amount, and the shop holds one rate
 *   for the whole order;
 * - money is a number with two decimals, not a string and not a float that
 *   drifted, because the total on the document has to be the total that was
 *   charged.
 */
import { describe, it, expect } from "vitest";
import {
    contactPayload,
    invoicePayload,
    providerCurrency,
} from "@/modules/parasut-invoicing/lib/invoice-payload";

const company = {
    kind: "company" as const,
    name: "Analytical Engines Ltd",
    taxNumber: "1234567890",
    taxOffice: "Kadikoy",
    address: "12 Analytical Street",
    city: "Istanbul",
    country: "TR",
};

const person = {
    kind: "individual" as const,
    name: "Ada Lovelace",
    taxNumber: "",
    taxOffice: "",
    address: "12 Analytical Street",
    city: "Istanbul",
    country: "TR",
};

describe("the customer an invoice is made out to", () => {
    it("is a company when the buyer said so, with both of the things a company has", () => {
        expect(contactPayload(company, "buyer@example.com")).toEqual({
            data: {
                type: "contacts",
                attributes: {
                    name: "Analytical Engines Ltd",
                    email: "buyer@example.com",
                    contact_type: "company",
                    account_type: "customer",
                    tax_number: "1234567890",
                    tax_office: "Kadikoy",
                    address: "12 Analytical Street",
                    city: "Istanbul",
                },
            },
        });
    });

    it("is a person otherwise, and sends no tax office at all", () => {
        const sent = contactPayload(person, "ada@example.com");
        expect(sent.data.attributes.contact_type).toBe("person");
        // Not an empty string: a field the service will not take is worse
        // than a field that is not there.
        expect("tax_office" in sent.data.attributes).toBe(false);
    });

    it("still sends a person's tax number when they gave one", () => {
        const withNumber = { ...person, taxNumber: "11111111111" };
        expect(contactPayload(withNumber, "ada@example.com").data.attributes.tax_number)
            .toBe("11111111111");
    });

    it("leaves the number out entirely when there is none", () => {
        expect("tax_number" in contactPayload(person, "ada@example.com").data.attributes).toBe(false);
    });
});

describe("how the service spells a currency", () => {
    it("calls the Turkish lira TRL, not the code the shop prices in", () => {
        expect(providerCurrency("TRY")).toBe("TRL");
        expect(providerCurrency("try")).toBe("TRL");
    });

    it("leaves every other code alone", () => {
        expect(providerCurrency("EUR")).toBe("EUR");
        expect(providerCurrency("usd")).toBe("USD");
    });
});

describe("the invoice itself", () => {
    const order = {
        orderNumber: "ORD-MHK2X9Q-A3F1",
        currency: "TRY",
        taxRate: 20,
        lines: [
            { name: "VIP", quantity: 2, unitAmount: 49.995 },
            { name: "Rare key", quantity: 1, unitAmount: 10 },
        ],
    };

    const built = invoicePayload({
        contactId: "9876",
        order,
        issuedOn: new Date("2026-09-09T12:00:00Z"),
    });

    it("points at the customer it is for", () => {
        expect(built.data.relationships.contact).toEqual({
            data: { type: "contacts", id: "9876" },
        });
    });

    it("says which sale it is, so it can be found from either side", () => {
        expect(built.data.attributes.description).toContain("ORD-MHK2X9Q-A3F1");
    });

    it("is dated the day it was issued, not a moment", () => {
        expect(built.data.attributes.issue_date).toBe("2026-09-09");
    });

    it("carries one line per thing that was bought", () => {
        expect(built.data.relationships.details.data).toHaveLength(2);
        expect(built.data.relationships.details.data[0]).toEqual({
            type: "sales_invoice_details",
            attributes: {
                quantity: 2,
                unit_price: 50,
                vat_rate: 20,
                description: "VIP",
            },
        });
    });

    it("rounds a price to the money it actually charged", () => {
        // 49.995 was never charged. Sending it puts a total on a legal
        // document that does not match the one taken from the card.
        expect(built.data.relationships.details.data[0].attributes.unit_price).toBe(50);
    });

    it("puts the shop's tax rate on every line", () => {
        for (const line of built.data.relationships.details.data) {
            expect(line.attributes.vat_rate).toBe(20);
        }
    });

    it("says it is an invoice and in the currency the service knows", () => {
        expect(built.data.type).toBe("sales_invoices");
        expect(built.data.attributes.item_type).toBe("invoice");
        expect(built.data.attributes.currency).toBe("TRL");
    });

    it("charges no tax when the shop charges none", () => {
        const untaxed = invoicePayload({
            contactId: "1",
            order: { ...order, taxRate: 0 },
            issuedOn: new Date("2026-09-09T12:00:00Z"),
        });
        expect(untaxed.data.relationships.details.data[0].attributes.vat_rate).toBe(0);
    });
});
