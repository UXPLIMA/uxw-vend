/**
 * What this module tells an operator it has done.
 *
 * It creates a sales invoice in the accounting service. It used to write
 * `issued` against the order afterwards, and an operator who installed this
 * because they are obliged to issue invoices reads `issued` as the obligation
 * being met.
 *
 * That is not what happened. Turning the record into a legal e-document is a
 * second call this module does not make: the provider's documentation was not
 * reachable when it was built, and guessing the shape of a call that puts a
 * document into somebody's tax filing is not a thing to do from memory. The
 * call is still missing, and that is a known gap.
 *
 * A known gap an operator can see is a task. A known gap dressed as `issued`
 * is a shop that believes its invoicing is finished, finds out at an audit,
 * and cannot tell which orders were affected because every row says the same
 * reassuring word.
 *
 * So the two things are recorded apart. `status` says what this module did to
 * the sale. `legalDocument` says where the e-document stands, and it has one
 * value today because there is one thing that is true today. When the second
 * call lands it gains values and nothing else here has to change.
 */

/** What this module did with the sale. */
export const INVOICE_STATUSES = ["pending", "recorded", "failed"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Where the legal document stands.
 *
 * One value, because one thing is true: nothing here asks for one. A second
 * value would be a state this module cannot produce, which is the shape the
 * status field was already in.
 */
export const LEGAL_STATES = ["not_requested"] as const;
export type LegalState = (typeof LEGAL_STATES)[number];

export interface InvoiceRow {
    status: InvoiceStatus;
    legalDocument: LegalState;
}

export interface OperatorSummary {
    /** The sale is in the accounting service. */
    recorded: boolean;
    /** Always false while this module cannot ask for a document. */
    legallyIssued: boolean;
}

export function operatorSummary(row: InvoiceRow): OperatorSummary {
    return {
        recorded: row.status === "recorded",
        // Not derived from the status on purpose. Deriving it is how the two
        // came to mean the same thing in the first place.
        legallyIssued: false,
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
    return !operatorSummary(row).legallyIssued;
}
