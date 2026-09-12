// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
    documentKind,
    eArchivePayload,
    eInvoicePayload,
    internetPaymentType,
    legalStateFrom,
    documentNeedsAttention,
} from "../../../module-sources/parasut-invoicing/lib/e-document";

/**
 * The half of invoicing this module used to leave undone.
 *
 * It wrote the sale into the accounting service and stopped there, which is
 * a record rather than a document: what the tax authority has is made by a
 * second call, and the module said so in its own comments rather than making
 * it, because the provider's documentation could not be reached.
 *
 * Which call it is depends on the buyer. A tax number registered for e-Fatura
 * has an inbox at the authority and the document must be addressed to it;
 * sending that buyer an e-Arşiv files it in the wrong register. Everybody
 * else is owed an e-Arşiv, and because the sale happened on a website it has
 * to carry where and how it was paid for, or it is refused.
 *
 * These are the decisions and the shapes. The socket is next door and cannot
 * be exercised without a live account, which is exactly why the thinking is
 * on this side of the line.
 */
describe("a sale becomes the document the buyer is owed", () => {
    const inbox = { id: "77", address: "urn:mail:defaultpk@example.invalid" };

    it("sends an e-invoice to a buyer who has an inbox", () => {
        expect(documentKind(inbox)).toBe("e_invoice");
        const payload = eInvoicePayload({ salesInvoiceId: "1001", inbox });
        expect(payload.data.type).toBe("e_invoices");
        expect(payload.data.attributes.to).toBe(inbox.address);
        expect(payload.data.relationships.sales_invoice.data.id).toBe("1001");
        expect(payload.data.relationships.invoice.data).toEqual({ type: "e_invoice_inboxes", id: "77" });
    });

    it("sends it under the scenario the recipient never agreed to answer", () => {
        // Commercial means the buyer accepts or rejects it. A shop that never
        // agreed that with anybody would leave every document waiting.
        expect(eInvoicePayload({ salesInvoiceId: "1", inbox }).data.attributes.scenario).toBe("basic");
    });

    it("sends an e-archive to everybody else, saying where the sale happened", () => {
        expect(documentKind(null)).toBe("e_archive");
        const payload = eArchivePayload({
            salesInvoiceId: "1002",
            shopUrl: "https://shop.example.invalid",
            paymentMethod: "stripe",
            paidAt: new Date("2026-09-12T10:30:00Z"),
        });
        expect(payload.data.type).toBe("e_archives");
        expect(payload.data.attributes.is_internet_sale).toBe(true);
        expect(payload.data.attributes.internet_sale).toEqual({
            url: "https://shop.example.invalid",
            payment_type: "KREDIKARTI/BANKAKARTI",
            payment_platform: "stripe",
            payment_date: "2026-09-12",
        });
        expect(payload.data.relationships.sales_invoice.data.id).toBe("1002");
    });

    it("names the payment in the words the authority accepts", () => {
        expect(internetPaymentType("iyzico")).toBe("KREDIKARTI/BANKAKARTI");
        expect(internetPaymentType("bank_transfer")).toBe("EFT/HAVALE");
        expect(internetPaymentType("cash on delivery")).toBe("KAPIDAODEME");
        // Anything this shop calls something else is an intermediary, which
        // is what a gateway is. Leaving the field out has the document
        // refused, so there is no "unknown" to fall back to.
        expect(internetPaymentType("credits")).toBe("ODEMEARACISI");
        expect(internetPaymentType(null)).toBe("ODEMEARACISI");
    });

    it("reads the authority's answer as one of ours", () => {
        expect(legalStateFrom("approved")).toBe("approved");
        expect(legalStateFrom("refused")).toBe("refused");
        // Two words for the same thing an operator can do nothing about.
        expect(legalStateFrom("waiting")).toBe("waiting");
        expect(legalStateFrom("pending")).toBe("waiting");
        // A word nobody has seen is not approval.
        expect(legalStateFrom("something-new")).toBe("submitted");
        expect(legalStateFrom(null)).toBe("submitted");
    });

    it("says which sales still need a person", () => {
        expect(documentNeedsAttention("refused")).toBe(true);
        expect(documentNeedsAttention("failed")).toBe(true);
        expect(documentNeedsAttention("not_requested")).toBe(true);
        expect(documentNeedsAttention("waiting")).toBe(false);
        expect(documentNeedsAttention("approved")).toBe(false);
    });
});
