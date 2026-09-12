/**
 * Asking the authority for the document a recorded sale is owed.
 *
 * One function, because two callers need exactly this and neither should
 * carry a copy: the completion hook, when the operator has it on automatic,
 * and the panel button for a sale where it was not sent or was refused.
 *
 * It is deliberately not automatic by default. What this does is
 * irreversible - a document in front of the tax authority is cancelled by a
 * procedure rather than a delete - so the operator turns it on knowing that,
 * or presses the button per sale.
 */
import { log, prisma } from "@/core/sdk/server";
import { createRecord, ProviderError, withProvider } from "./client";
import { documentStanding, findInbox, submitDocument } from "./e-document-calls";
import { documentKind, eArchivePayload, eInvoicePayload, type DocumentKind } from "./e-document";

export interface DocumentRequest {
    orderId: string;
    /** The service's id for the sales invoice this document is for. */
    salesInvoiceId: string;
    /** The buyer's tax number, which decides which document they are owed. */
    taxNumber: string;
    /** Where the sale happened and how it was paid for, for an e-Arşiv. */
    shopUrl: string;
    paymentMethod: string | null;
    paidAt: Date;
    invoiceNumber: string | null;
}

export interface DocumentOutcome {
    kind: DocumentKind | null;
    state: string;
    reason: string | null;
}

/**
 * Send it, and write down what came back.
 *
 * The job id is kept even when the document cannot be read back yet: it is
 * the only handle on a submission the service has accepted but not finished,
 * and without it a retry would send a second document for the same sale.
 */
export async function sendLegalDocument(request: DocumentRequest): Promise<DocumentOutcome> {
    try {
        const outcome = await withProvider(async (config, token) => {
            const inbox = await findInbox(config, token, request.taxNumber);
            const kind = documentKind(inbox);

            const payload =
                kind === "e_invoice" && inbox
                    ? eInvoicePayload({ salesInvoiceId: request.salesInvoiceId, inbox })
                    : eArchivePayload({
                          salesInvoiceId: request.salesInvoiceId,
                          shopUrl: request.shopUrl,
                          paymentMethod: request.paymentMethod,
                          paidAt: request.paidAt,
                      });

            const jobId = await submitDocument(config, token, kind, payload);

            // Read it back straight away when the sale already has a number.
            // The authority rarely answers this fast, so `submitted` is the
            // normal result and the panel is what asks again later.
            const standing = request.invoiceNumber
                ? await documentStanding(config, token, kind, request.invoiceNumber)
                : null;

            return { kind, jobId, standing };
        });

        await prisma.issuedInvoice.update({
            where: { orderId: request.orderId },
            data: {
                legalKind: outcome.kind,
                legalJobId: outcome.jobId,
                legalDocument: outcome.standing?.state ?? "submitted",
                legalNumber: outcome.standing?.number ?? null,
                legalRemoteId: outcome.standing?.remoteId ?? null,
                legalReason: null,
                legalAt: new Date(),
            },
        });

        return {
            kind: outcome.kind,
            state: outcome.standing?.state ?? "submitted",
            reason: null,
        };
    } catch (err) {
        const reason = err instanceof ProviderError ? err.message : "The document could not be sent";
        // The order id, never the payload: it carries a tax number.
        log.error("[parasut-invoicing] sending a legal document failed", { orderId: request.orderId });
        await prisma.issuedInvoice.update({
            where: { orderId: request.orderId },
            data: { legalDocument: "failed", legalReason: reason, legalAt: new Date() },
        });
        return { kind: null, state: "failed", reason };
    }
}

/** Ask the service where a document got to, and write the answer down. */
export async function refreshLegalDocument(orderId: string): Promise<DocumentOutcome> {
    const row = await prisma.issuedInvoice.findUnique({ where: { orderId } });
    if (!row || !row.legalKind || !row.remoteNumber) {
        return { kind: null, state: row?.legalDocument ?? "not_requested", reason: null };
    }

    try {
        const standing = await withProvider((config, token) =>
            documentStanding(config, token, row.legalKind as DocumentKind, row.remoteNumber as string),
        );
        if (!standing) return { kind: row.legalKind as DocumentKind, state: row.legalDocument, reason: null };

        await prisma.issuedInvoice.update({
            where: { orderId },
            data: {
                legalDocument: standing.state,
                legalNumber: standing.number,
                legalRemoteId: standing.remoteId,
                legalAt: new Date(),
            },
        });
        return { kind: row.legalKind as DocumentKind, state: standing.state, reason: null };
    } catch (err) {
        const reason = err instanceof ProviderError ? err.message : "The document could not be read";
        log.error("[parasut-invoicing] reading a legal document failed", { orderId });
        return { kind: row.legalKind as DocumentKind, state: row.legalDocument, reason };
    }
}

/** Re-exported so a caller needs one import for the whole second half. */
export { createRecord };
