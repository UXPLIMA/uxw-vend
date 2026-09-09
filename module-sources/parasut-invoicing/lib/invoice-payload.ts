/**
 * One paid order, as the two documents an accounting service keeps.
 *
 * The service holds customers and invoices separately: an invoice points at a
 * contact, so a first sale to somebody creates the contact and every sale
 * after it reuses the id. Both travel in JSON:API - a `data` object with a
 * `type`, its `attributes`, and `relationships` to the rows it points at.
 *
 * Getting the shape subtly wrong is not visible until it is too late: a
 * rejected invoice comes back as a validation error long after the money
 * moved, and the sale is already done. So the mapping lives here on its own,
 * away from anything that opens a socket, and is pinned by tests.
 */

/** Who the invoice is made out to, as the store records it. */
export interface BillingIdentity {
    kind: "individual" | "company";
    name: string;
    taxNumber: string;
    taxOffice: string;
    address: string;
    city: string;
    country: string;
}

/** What was sold, in the shop's own numbers. */
export interface InvoicedOrder {
    orderNumber: string;
    /** ISO 4217, as the shop prices in. */
    currency: string;
    /** One rate for the whole order, as the shop charges it. */
    taxRate: number;
    lines: { name: string; quantity: number; unitAmount: number }[];
}

/** Money as it goes on a document: the number that was actually charged. */
function money(amount: number): number {
    return Math.round(amount * 100) / 100;
}

/**
 * How the service spells a currency.
 *
 * It calls the Turkish lira `TRL`, which is not the ISO code the shop prices
 * in. Sending `TRY` is an invoice in a currency it does not know.
 */
export function providerCurrency(code: string): string {
    const upper = code.trim().toUpperCase();
    return upper === "TRY" ? "TRL" : upper;
}

/** A date as the service reads one: a day, not a moment. */
function day(at: Date): string {
    return at.toISOString().slice(0, 10);
}

/**
 * The customer.
 *
 * A person and a company are different kinds here, and only one of them has a
 * tax office. An empty string is a field the service will not take, so what a
 * buyer does not have is left out rather than sent blank.
 */
export function contactPayload(billing: BillingIdentity, email: string) {
    const attributes: Record<string, string> = {
        name: billing.name,
        email,
        contact_type: billing.kind === "company" ? "company" : "person",
        account_type: "customer",
    };
    if (billing.taxNumber.trim() !== "") attributes.tax_number = billing.taxNumber.trim();
    // A person has no tax office. Sending one, even empty, is a field the
    // service refuses on a contact that is not a business.
    if (billing.kind === "company" && billing.taxOffice.trim() !== "") {
        attributes.tax_office = billing.taxOffice.trim();
    }
    if (billing.address.trim() !== "") attributes.address = billing.address.trim();
    if (billing.city.trim() !== "") attributes.city = billing.city.trim();

    return { data: { type: "contacts" as const, attributes } };
}

/** The invoice, pointing at a contact the service already holds. */
export function invoicePayload(input: {
    contactId: string;
    order: InvoicedOrder;
    issuedOn: Date;
}) {
    const { contactId, order, issuedOn } = input;
    const rate = Number.isFinite(order.taxRate) && order.taxRate > 0 ? order.taxRate : 0;

    return {
        data: {
            type: "sales_invoices" as const,
            attributes: {
                item_type: "invoice" as const,
                // Names the sale on the document, so an accountant looking at
                // either side can find the other.
                description: `Order ${order.orderNumber}`,
                issue_date: day(issuedOn),
                currency: providerCurrency(order.currency),
            },
            relationships: {
                contact: { data: { type: "contacts" as const, id: contactId } },
                details: {
                    data: order.lines.map((line) => ({
                        type: "sales_invoice_details" as const,
                        attributes: {
                            quantity: line.quantity,
                            // The number that was charged, not the one that
                            // came out of a discount calculation: a total on a
                            // legal document has to match the card statement.
                            unit_price: money(line.unitAmount),
                            vat_rate: rate,
                            description: line.name,
                        },
                    })),
                },
            },
        },
    };
}
