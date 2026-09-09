/**
 * What this gateway costs, when the operator has chosen to pass it on.
 *
 * The store does not know what any gateway charges and should not: a gateway
 * is the only thing that knows its own rates. So the offer travels with the
 * provider descriptor the checkout page already reads, and a gateway that does
 * not offer the choice leaves it out entirely.
 *
 * The store grosses the charge up rather than adding the percentage, because
 * the processor takes its cut of the larger amount too.
 */

/** The three settings an operator fills in, as read from the site settings. */
export interface FeeSettings {
    pass: boolean;
    percent: number;
    fixed: number;
}

const number = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

/**
 * The fee to declare, or nothing.
 *
 * Switched off is the same as absent: a rate typed while the switch is off is
 * a rate nobody chose to charge, and declaring it would have the store gross
 * up an order the operator never agreed to. Zero and zero is not a fee of
 * nothing either - it is no offer, and the checkout should not carry a line
 * reading 0.00.
 */
export function passOnFeeFrom(settings: FeeSettings): { percent: number; fixed: number } | undefined {
    if (!settings.pass) return undefined;
    const percent = number(settings.percent);
    const fixed = number(settings.fixed);
    if (percent === 0 && fixed === 0) return undefined;
    return { percent, fixed };
}
