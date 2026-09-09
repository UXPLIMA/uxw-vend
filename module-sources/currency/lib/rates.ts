/**
 * The rate between two currencies, from rates quoted against one base.
 *
 * Every rate on file says how many of a currency make one of the base, so
 * asking "how many lira per euro" means going through the base. The direction
 * is what gets inverted by accident, and inverting it at 39 to the dollar
 * charges a buyer a thirtieth of the price while the order is still marked
 * paid - which is why this is a named function with its own tests rather than
 * a division written at the call site.
 *
 * Null is a real answer. A payment that cannot start leaves an order unpaid
 * and somebody can fix the rate; an undercharge is money gone.
 */

const usable = (rate: number | undefined): rate is number =>
    typeof rate === "number" && Number.isFinite(rate) && rate > 0;

export function crossRate(from: string, to: string, rates: Map<string, number>): number | null {
    const source = from.trim().toUpperCase();
    const target = to.trim().toUpperCase();
    if (source === target) return 1;

    const perBaseFrom = rates.get(source);
    const perBaseTo = rates.get(target);
    if (!usable(perBaseFrom) || !usable(perBaseTo)) return null;

    return perBaseTo / perBaseFrom;
}
