/**
 * Turning a recorded sale into a legal document.
 *
 * This is the second half of invoicing, and it was missing. The module wrote
 * the sale into the accounting service and stopped; what makes it a document
 * the tax authority has is another call, and which call depends on who the
 * buyer is.
 *
 * A buyer registered for e-Fatura has an inbox at the authority, and the
 * document has to be addressed to it: sending them an e-Arşiv instead is a
 * document to the wrong register. Everybody else - a consumer, a company that
 * is not registered - gets an e-Arşiv, and when the sale happened on a
 * website that carries the shop's URL and how it was paid for.
 *
 * So the order is always: ask whether this tax number has an inbox, then send
 * the one the answer implies.
 *
 * Both calls answer with a job rather than a document. The authority takes
 * its own time, and the states it passes through - waiting, then approved or
 * refused - are the ones an operator has to be shown, because a refused
 * document is a sale with no invoice and somebody has to do something about
 * it.
 *
 * Everything here is shape and decision, with no socket in it, for the reason
 * the payload builder next door says: this half cannot be exercised without a
 * live account, and an invoice that is wrong is wrong after the money moved.
 */

/** Which document a buyer is owed. */
export type DocumentKind = "e_invoice" | "e_archive";

/** How the shop took the money, in the words the authority accepts. */
export type InternetPaymentType =
    | "KREDIKARTI/BANKAKARTI"
    | "EFT/HAVALE"
    | "KAPIDAODEME"
    | "ODEMEARACISI";

/** An inbox at the authority, when the buyer has one. */
export interface EInvoiceInbox {
    id: string;
    /** The address the document is sent to. */
    address: string;
}

/**
 * What the shop's payment method means to the authority.
 *
 * A method it has never heard of is a payment through an intermediary, which
 * is what a gateway is: the alternative is leaving the field out, and the
 * document is refused for it.
 */
export function internetPaymentType(paymentMethod: string | null | undefined): InternetPaymentType {
    const method = (paymentMethod ?? "").toLowerCase();
    if (/bank|transfer|havale|eft|wire/.test(method)) return "EFT/HAVALE";
    if (/cash|kapida|delivery/.test(method)) return "KAPIDAODEME";
    if (/card|kart|stripe|iyzico|paytr|param/.test(method)) return "KREDIKARTI/BANKAKARTI";
    return "ODEMEARACISI";
}

/**
 * Which document this sale needs.
 *
 * The inbox is the whole test. A tax number that has one is registered for
 * e-Fatura whether the buyer is a company or a person trading as one, and a
 * tax number that does not is not, whatever the shop recorded them as.
 */
export function documentKind(inbox: EInvoiceInbox | null): DocumentKind {
    return inbox ? "e_invoice" : "e_archive";
}

/**
 * The scenario an e-Fatura is sent under.
 *
 * Commercial means the recipient answers it - accepts or rejects - and basic
 * means they do not. A shop selling to a business that did not agree to
 * anything else is sending a basic invoice; asking for an answer nobody
 * agreed to give leaves the document waiting forever.
 */
export function eInvoiceScenario(): "basic" | "commercial" {
    return "basic";
}

export function eInvoicePayload(input: {
    salesInvoiceId: string;
    inbox: EInvoiceInbox;
    note?: string | null;
}) {
    return {
        data: {
            type: "e_invoices" as const,
            attributes: {
                scenario: eInvoiceScenario(),
                to: input.inbox.address,
                ...(input.note ? { note: input.note } : {}),
            },
            relationships: {
                sales_invoice: { data: { type: "sales_invoices" as const, id: input.salesInvoiceId } },
                invoice: { data: { type: "e_invoice_inboxes" as const, id: input.inbox.id } },
            },
        },
    };
}

export function eArchivePayload(input: {
    salesInvoiceId: string;
    /** Where the sale happened, which the authority asks for by name. */
    shopUrl: string;
    paymentMethod: string | null;
    paidAt: Date;
    note?: string | null;
}) {
    return {
        data: {
            type: "e_archives" as const,
            attributes: {
                // A sale made on a website says so, and then has to say where
                // and how. Left out, the document is refused.
                is_internet_sale: true,
                internet_sale: {
                    url: input.shopUrl,
                    payment_type: internetPaymentType(input.paymentMethod),
                    payment_platform: input.paymentMethod ?? "",
                    payment_date: input.paidAt.toISOString().slice(0, 10),
                },
                ...(input.note ? { note: input.note } : {}),
            },
            relationships: {
                sales_invoice: { data: { type: "sales_invoices" as const, id: input.salesInvoiceId } },
            },
        },
    };
}

/** Where a document stands, in this module's words. */
export const LEGAL_STATES = [
    "not_requested",
    "submitted",
    "waiting",
    "approved",
    "refused",
    "failed",
] as const;
export type LegalState = (typeof LEGAL_STATES)[number];

/**
 * The service's word for it, in ours.
 *
 * `waiting` and `pending` are both "the authority has it and has not
 * answered"; they are one state to an operator, who can do nothing about
 * either. `refused` is the one that needs a person.
 */
export function legalStateFrom(status: string | null | undefined): LegalState {
    switch ((status ?? "").toLowerCase()) {
        case "approved":
            return "approved";
        case "refused":
            return "refused";
        case "waiting":
        case "pending":
            return "waiting";
        default:
            return "submitted";
    }
}

/** Whether an operator still has something to do about this document. */
export function documentNeedsAttention(state: LegalState): boolean {
    return state === "refused" || state === "failed" || state === "not_requested";
}
