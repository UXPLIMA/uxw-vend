/**
 * A legal invoice issued twice for one sale is worse than one issued late.
 *
 * The trigger is an order being completed, and that arrives more than once in
 * normal operation: a gateway retries its callback, an operator marks an order
 * paid that a webhook was already settling, a container restarts mid-request.
 * None of those should produce a second document, because a second document is
 * a second entry in somebody's books and it has to be cancelled by hand.
 *
 * So the claim is written before the call, not after it. A row that exists is
 * the answer to "has this been issued", and the unique key on the order is
 * what makes two racing completions produce one invoice rather than two.
 *
 * The other direction matters too. An order with nobody to invoice must not
 * be dropped quietly: the operator installed this module because they have to
 * issue invoices, and an order they cannot is something they need to see.
 */
import { describe, it, expect } from "vitest";
import { whatToDoWith } from "@/modules/parasut-invoicing/lib/decide";

const billing = {
    kind: "company" as const,
    name: "Analytical Engines Ltd",
    taxNumber: "1234567890",
    taxOffice: "Kadikoy",
    address: "12 Analytical Street",
    city: "Istanbul",
    country: "TR",
};

const order = {
    id: "order-1",
    status: "COMPLETED",
    billingDetails: billing,
    total: 120,
};

describe("an order that was just completed", () => {
    it("is invoiced when nothing has been issued for it", () => {
        expect(whatToDoWith(order, null)).toEqual({ issue: true, billing });
    });

    it("is not invoiced twice", () => {
        const already = { status: "issued" as const };
        expect(whatToDoWith(order, already)).toEqual({ skip: "already-issued" });
    });

    it("is not invoiced while another attempt is in flight", () => {
        // The claim is written before the call, so a row that is still
        // pending means somebody is on it. A retry that ignored this is
        // exactly how two documents get issued.
        expect(whatToDoWith(order, { status: "pending" })).toEqual({ skip: "already-issued" });
    });

    it("is tried again after an attempt that failed", () => {
        // Nothing was issued, so there is nothing to duplicate.
        expect(whatToDoWith(order, { status: "failed" })).toEqual({ issue: true, billing });
    });
});

describe("an order that cannot be invoiced", () => {
    it("is held for the operator rather than dropped", () => {
        // They installed this because they have to issue invoices. An order
        // they cannot is the one thing they need to be told about.
        expect(whatToDoWith({ ...order, billingDetails: null }, null))
            .toEqual({ hold: "no-billing-identity" });
    });

    it("is held when the identity on it is not one", () => {
        // The column is JSON and an order may predate the shape, or have been
        // written by hand.
        expect(whatToDoWith({ ...order, billingDetails: "Ada Lovelace" }, null))
            .toEqual({ hold: "no-billing-identity" });
        expect(whatToDoWith({ ...order, billingDetails: { ...billing, name: "" } }, null))
            .toEqual({ hold: "no-billing-identity" });
    });

    it("is held when a company gave no tax number", () => {
        // The service refuses it, and finding that out per order is a queue
        // of failures instead of one thing to fix.
        expect(whatToDoWith({ ...order, billingDetails: { ...billing, taxNumber: "" } }, null))
            .toEqual({ hold: "no-billing-identity" });
    });
});

describe("an order that is not a sale yet", () => {
    it("is left alone until it is paid for", () => {
        expect(whatToDoWith({ ...order, status: "PENDING" }, null)).toEqual({ skip: "not-paid" });
        expect(whatToDoWith({ ...order, status: "CANCELLED" }, null)).toEqual({ skip: "not-paid" });
    });

    it("is left alone when it is worth nothing", () => {
        // A free order is not a sale, and an invoice for zero is a document
        // nobody wants and some authorities refuse.
        expect(whatToDoWith({ ...order, total: 0 }, null)).toEqual({ skip: "nothing-to-invoice" });
    });
});
