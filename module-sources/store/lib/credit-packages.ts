/**
 * Selling credits in packages, with a bonus for buying more.
 *
 * The shop sold credits by the unit: a buyer typed a number and paid that
 * number times a price. It works and it sells nothing - there is no reason to
 * buy a thousand rather than a hundred, and an operator has no way to say
 * "buy this much and we round it up".
 *
 * A package is two numbers that must never be confused. One is what the buyer
 * is charged, and it is the only number a gateway ever sees. The other is what
 * lands in their balance, and it is the larger. Add the bonus on the wrong
 * side and either the buyer pays for credits they were given, or the shop
 * hands out a bonus on a bonus.
 */

/** A package as an operator sets it up. */
export interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    /** Given on top, and never part of the price. */
    bonusCredits: number;
    price: unknown;
    isActive: boolean;
}

/** A count of credits: whole, and never negative. */
function count(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
}

/** Money, as a gateway is asked for it. */
function money(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

/** What lands in the buyer's balance. */
export function creditsGranted(pack: CreditPackage): number {
    return count(pack.credits) + count(pack.bonusCredits);
}

/**
 * What travels with the payment.
 *
 * A gateway settles minutes later, and days later for a transfer confirmed by
 * hand. An operator editing a package in between must not change what
 * somebody already bought: the sale was at the price on the page, so the
 * numbers are taken here and carried rather than looked up again on the way
 * back.
 */
export function packageSnapshot(pack: CreditPackage): {
    packageId: string;
    name: string;
    credits: number;
    price: number;
} {
    return {
        packageId: pack.id,
        name: pack.name,
        credits: creditsGranted(pack),
        price: money(pack.price),
    };
}

/** Whether a buyer may pick it. */
export function buyableNow(pack: CreditPackage): boolean {
    if (!pack.isActive) return false;
    if (creditsGranted(pack) <= 0) return false;
    // Free credits are a grant, not a sale, and a gateway refuses a zero
    // charge anyway.
    return money(pack.price) > 0;
}
