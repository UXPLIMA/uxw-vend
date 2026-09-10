/**
 * Whether this order gets an invoice, right now.
 *
 * The trigger is an order being completed, and that arrives more than once in
 * normal operation: a gateway retries its callback, an operator marks an order
 * paid that a webhook was already settling, a container restarts mid-request.
 * A second legal invoice is a second entry in somebody's books and has to be
 * cancelled by hand, so the answer is decided here, from the order and from
 * whatever was already recorded against it.
 *
 * Nothing in this file reaches the network or the database. The row it is
 * handed is the claim, written before the call rather than after it, which is
 * what makes two racing completions produce one document.
 */
import type { BillingIdentity } from "./invoice-payload";
import type { InvoiceStatus } from "./invoice-state";

/** What has already been attempted for this order, or null for nothing. */
export interface IssuedRecord {
    status: InvoiceStatus;
}

/** The order, as much of it as this decision needs. */
export interface CompletedOrder {
    id: string;
    status: string;
    /** JSON, so its shape is not guaranteed. */
    billingDetails: unknown;
    total: unknown;
}

export type InvoiceDecision =
    | { issue: true; billing: BillingIdentity }
    | { skip: "already-issued" | "not-paid" | "nothing-to-invoice" }
    | { hold: "no-billing-identity" };

/**
 * The identity on the order, or null when there is not one worth sending.
 *
 * A company with no tax number is refused by the service, and finding that
 * out one order at a time is a queue of failures instead of one thing for an
 * operator to fix.
 */
function identityIn(value: unknown): BillingIdentity | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string).trim() : "");

    const kind = row.kind === "company" ? "company" : row.kind === "individual" ? "individual" : null;
    if (!kind) return null;
    const name = text("name");
    if (name === "") return null;
    const taxNumber = text("taxNumber");
    if (kind === "company" && taxNumber === "") return null;

    return {
        kind,
        name,
        taxNumber,
        taxOffice: text("taxOffice"),
        address: text("address"),
        city: text("city"),
        country: text("country"),
    };
}

export function whatToDoWith(order: CompletedOrder, issued: IssuedRecord | null): InvoiceDecision {
    if (order.status !== "COMPLETED") return { skip: "not-paid" };

    const total = Number(order.total);
    // A free order is not a sale, and an invoice for zero is a document
    // nobody wants and some authorities refuse.
    if (!Number.isFinite(total) || total <= 0) return { skip: "nothing-to-invoice" };

    // A pending row means somebody is on it: the claim goes in before the
    // call. A failed one issued nothing, so there is nothing to duplicate.
    if (issued && issued.status !== "failed") return { skip: "already-issued" };

    const billing = identityIn(order.billingDetails);
    if (!billing) return { hold: "no-billing-identity" };

    return { issue: true, billing };
}
