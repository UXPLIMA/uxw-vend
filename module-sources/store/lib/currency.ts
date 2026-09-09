/**
 * The currency this store charges in, reduced to something a gateway can use.
 *
 * `default_currency` is a free-text setting with `usd` for a placeholder, and
 * the provider list additionally prefers a currency from the query string, so
 * the raw value is not merely typed by an operator, it can be chosen by the
 * caller. Passed on unchecked it reaches a payment provider, where a wrong
 * code is a refused charge, and `Intl.NumberFormat`, where anything that is
 * not three letters is a RangeError.
 *
 * Takes the values in preference order and returns the first that is an ISO
 * 4217 code, or the fallback. It never returns anything else, which is the
 * property the callers depend on.
 */
const ISO_4217 = /^[A-Z]{3}$/;

export const FALLBACK_CURRENCY = "USD";

export function resolveCurrency(...candidates: (string | null | undefined)[]): string {
    for (const candidate of candidates) {
        if (typeof candidate !== "string") continue;
        const code = candidate.trim().toUpperCase();
        if (ISO_4217.test(code)) return code;
    }
    return FALLBACK_CURRENCY;
}

/**
 * What to charge a gateway that settles in a currency the shop does not price
 * in, or null when it cannot be worked out.
 *
 * Handing a processor the shop's number with a different currency code
 * attached is the failure that looks like it worked: 100 USD becomes 100 TRY,
 * the buyer pays a fraction of the price and the order is marked paid. So this
 * refuses rather than guesses. A payment that cannot start leaves the order
 * unpaid and somebody can fix the rate; an undercharge is money gone.
 *
 * Nothing needs no rate: an order of zero is zero in every currency, and
 * asking for a rate to convert it would refuse a free order for no reason.
 */
export function convertedCharge(amount: number, rate: number | null): number | null {
    if (amount <= 0) return 0;
    if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
    return Math.round(amount * rate * 100) / 100;
}
