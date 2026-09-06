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
