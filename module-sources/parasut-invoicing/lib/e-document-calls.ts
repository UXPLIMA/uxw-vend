/**
 * The calls that turn a recorded sale into a legal document.
 *
 * Kept apart from the decisions next door for the reason the rest of this
 * module is: what goes on a document is pinned by tests, and what opens a
 * socket cannot be, because it needs a live account and a tax authority.
 *
 * Two of these answer with a job rather than a document. The authority takes
 * its own time; the module writes down the job, and reads the document back
 * when an operator or a later completion asks.
 */
import { createRecord, readRecords, type ProviderConfig } from "./client";
import { legalStateFrom, type DocumentKind, type EInvoiceInbox, type LegalState } from "./e-document";

/**
 * Does this tax number have an inbox at the authority?
 *
 * The whole e-Fatura against e-Arşiv decision is this question. A number with
 * no inbox is not registered, which is most buyers, and is not an error.
 */
export async function findInbox(
    config: ProviderConfig,
    token: string,
    taxNumber: string,
): Promise<EInvoiceInbox | null> {
    const digits = taxNumber.replace(/\D/g, "");
    if (digits.length < 10) return null;

    const rows = await readRecords(config, token, `e_invoice_inboxes?filter[vkn]=${encodeURIComponent(digits)}`);
    const row = rows[0];
    if (!row) return null;

    const address = row.attributes.e_invoice_address;
    if (typeof address !== "string" || address === "") return null;
    return { id: row.id, address };
}

/** Send the document, and answer with the job the service is doing it under. */
export async function submitDocument(
    config: ProviderConfig,
    token: string,
    kind: DocumentKind,
    payload: unknown,
): Promise<string> {
    const collection = kind === "e_invoice" ? "e_invoices" : "e_archives";
    const job = await createRecord(config, token, collection, payload);
    return job.id;
}

export interface DocumentStanding {
    state: LegalState;
    /** The official number, once the authority has issued one. */
    number: string | null;
    /** The service's own id for the document, for a link out of the panel. */
    remoteId: string | null;
}

/**
 * Where the document stands.
 *
 * Read back by the shop's own reference rather than by the job: a job says
 * whether the service finished its part, and what an operator is owed is
 * whether the authority approved the document.
 */
export async function documentStanding(
    config: ProviderConfig,
    token: string,
    kind: DocumentKind,
    invoiceNumber: string,
): Promise<DocumentStanding | null> {
    const collection = kind === "e_invoice" ? "e_invoices" : "e_archives";
    const rows = await readRecords(
        config,
        token,
        `${collection}?filter[invoice_number]=${encodeURIComponent(invoiceNumber)}`,
    );
    const row = rows[0];
    if (!row) return null;

    const number = row.attributes.invoice_number;
    return {
        state: legalStateFrom(typeof row.attributes.status === "string" ? row.attributes.status : null),
        number: typeof number === "string" && number !== "" ? number : null,
        remoteId: row.id || null,
    };
}
