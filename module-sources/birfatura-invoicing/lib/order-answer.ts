/**
 * One order, in the shape a pulling integrator asks for.
 *
 * This service does not take invoices. It asks for orders: it calls the shop
 * on a schedule with a date window, gets a list back, and issues the legal
 * documents itself. So what this module ships is answers, and the whole of its
 * correctness is whether those answers describe the sale.
 *
 * It wants every price twice, once with tax and once without, and that is
 * where a shop gets it wrong. A shop quoting tax-inclusive prices - which is
 * the law for a consumer sale in most of the places this is used - already has
 * the tax inside the number on the page. Multiplying it up again puts a figure
 * on a legal document higher than what the customer paid. At twenty per cent
 * the tax inside 120 is 20, not 24.
 *
 * The store knows which way it prices. This reads that rather than assuming,
 * so the split on the document is the split the till used.
 */

import { writeTurkishDateTime } from "./turkish-date";

/** Money, as it goes on a document. */
function money(amount: number): number {
    return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

/**
 * One price, both ways.
 *
 * Net is derived and gross is kept when the shop prices tax-inclusive,
 * rather than both being rounded from a third number: rounding twice is how a
 * line comes out a penny short of what the customer was charged.
 */
export function splitLine(
    price: number,
    taxRate: number,
    taxIncluded: boolean,
): { excluding: number; including: number } {
    const rate = Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0;
    if (rate === 0) return { excluding: money(price), including: money(price) };
    if (taxIncluded) {
        return { excluding: money(price / (1 + rate / 100)), including: money(price) };
    }
    return { excluding: money(price), including: money(price * (1 + rate / 100)) };
}

/** Who the invoice is for, as the store records it. */
interface Billing {
    kind: string;
    name: string;
    taxNumber: string;
    taxOffice: string;
    address: string;
    city: string;
    country: string;
}

/** An order as this module reads it. */
export interface SoldOrder {
    id: string;
    orderNumber: string;
    createdAt: Date;
    currency: string;
    total: unknown;
    userId: string | null;
    email: string | null;
    paymentMethod: string | null;
    billingDetails: unknown;
    items: { productId: string | null; name: string; quantity: number; price: unknown }[];
}

/** How the shop charges tax, as the store settings hold it. */
export interface TaxSetup {
    /** The shop's own zone: what `dd.MM.yyyy HH:mm:ss` means. */
    timeZone: string;
    taxRate: number;
    taxIncluded: boolean;
}

function billingIn(value: unknown): Billing | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string).trim() : "");
    const name = text("name");
    if (name === "") return null;
    return {
        kind: text("kind"),
        name,
        taxNumber: text("taxNumber"),
        taxOffice: text("taxOffice"),
        address: text("address"),
        city: text("city"),
        country: text("country"),
    };
}

/**
 * The order, or null when there is nobody to invoice.
 *
 * Null rather than a name taken from the account: an invoice made out to a
 * username is a wrong legal document, and the integrator will issue it
 * without complaint.
 */
export function orderAnswer(order: SoldOrder, tax: TaxSetup): Record<string, unknown> | null {
    const billing = billingIn(order.billingDetails);
    if (!billing) return null;

    const details = order.items.map((item) => {
        const split = splitLine(Number(item.price), tax.taxRate, tax.taxIncluded);
        return {
            ProductId: item.productId ?? "",
            // The shop has no separate code for a product, and the integrator
            // uses this to group repeat sales of one thing.
            ProductCode: item.productId ?? "",
            ProductName: item.name,
            ProductQuantity: item.quantity,
            VatRate: Number.isFinite(tax.taxRate) && tax.taxRate > 0 ? tax.taxRate : 0,
            ProductUnitPriceTaxIncluding: split.including,
            ProductUnitPriceTaxExcluding: split.excluding,
        };
    });

    const paidTotal = splitLine(Number(order.total), tax.taxRate, tax.taxIncluded);

    return {
        OrderId: order.id,
        // The number the buyer sees on their confirmation, so an accountant
        // looking at either side can find the other.
        OrderCode: order.orderNumber,
        OrderDate: writeTurkishDateTime(order.createdAt, tax.timeZone),
        CustomerId: order.userId ?? "",
        BillingName: billing.name,
        BillingAddress: billing.address,
        BillingCity: billing.city,
        BillingTown: billing.city,
        // Their field for a national identity number. A company sends its tax
        // number in the same place.
        SSNTCNo: billing.taxNumber,
        TaxOffice: billing.taxOffice,
        Email: order.email ?? "",
        PaymentType: order.paymentMethod ?? "",
        Currency: order.currency.toUpperCase(),
        CurrencyRate: 1,
        TotalPaidTaxIncluding: paidTotal.including,
        TotalPaidTaxExcluding: paidTotal.excluding,
        OrderDetails: details,
    };
}
