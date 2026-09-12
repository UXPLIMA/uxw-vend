/**
 * What this module tells an operator it has done.
 *
 * It creates a sales invoice in the accounting service. It used to write
 * `issued` against the order afterwards, and an operator who installed this
 * because they are obliged to issue invoices reads `issued` as the obligation
 * being met.
 *
 * That is not what happened. Turning the record into a legal e-document is a
 * second call, and for a while this module did not make it: the provider's
 * documentation was not reachable when it was built, and guessing the shape
 * of a call that puts a document into somebody's tax filing is not a thing to
 * do from memory.
 *
 * It makes it now. The two things are still recorded apart, and that is the
 * part worth keeping: `status` says what this module did to the sale, and
 * `legalDocument` says where the document stands with the authority. They are
 * different questions - a sale can be recorded and its document refused - and
 * collapsing them into one reassuring word is what hid the gap in the first
 * place.
 */

/** What this module did with the sale. */
export const INVOICE_STATUSES = ["pending", "recorded", "failed"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Where the legal document stands.
 *
 * It had one value for as long as this module could not ask for a document.
 * It asks now - an e-Fatura to a buyer registered for one, an e-Arşiv to
 * everybody else - so the states are the ones that can actually happen:
 * nobody asked yet, the service has it, the authority has it, it was
 * approved, it was refused, or the call itself failed. The two that need a
 * person are `refused` and `failed`; see `e-document.ts`.
 */
export { LEGAL_STATES } from "./e-document";
export type { LegalState } from "./e-document";

import { documentNeedsAttention, type LegalState } from "./e-document";

export interface InvoiceRow {
    status: InvoiceStatus;
    legalDocument: LegalState;
}

export interface OperatorSummary {
    /** The sale is in the accounting service. */
    recorded: boolean;
    /** The authority approved the document. Nothing less counts. */
    legallyIssued: boolean;
}

export function operatorSummary(row: InvoiceRow): OperatorSummary {
    return {
        recorded: row.status === "recorded",
        // Not derived from the status on purpose. Deriving it is how the two
        // came to mean the same thing in the first place, and a document that
        // is waiting or refused is not an issued one.
        legallyIssued: row.legalDocument === "approved",
    };
}

/**
 * Whether this order is one the operator still has something to do about.
 *
 * A recorded sale counts. It looked finished under the old word and it is
 * not: the document is still owed, and the whole point of separating the two
 * fields is that the list of orders owing one can be read.
 */
export function needsAttention(row: InvoiceRow): boolean {
    if (row.status === "pending") return false;
    if (row.status === "failed") return true;
    // A document the authority is still thinking about is nobody's task; a
    // refused one, a failed call and a sale nobody has asked for a document
    // for are all somebody's.
    return documentNeedsAttention(row.legalDocument);
}
