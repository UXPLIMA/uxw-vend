/**
 * One member selling to another, with the site taking a cut.
 *
 * Three numbers move and they have to be the same number: what the buyer pays,
 * what the seller receives, and what the site keeps. This goes wrong quietly -
 * a rounding step run twice, so the three add up to one credit more or less
 * than the price, and months later a shop finds its currency slowly leaking.
 *
 * So only one of them is calculated. The cut comes from the price and the
 * seller's share is whatever is left, never a percentage of its own. Two
 * roundings of the same number cannot be made to agree; one of them has to be
 * the remainder.
 */

/** A listing, as much of it as a sale needs. */
export interface Listing {
    id: string;
    sellerId: string;
    price: number;
    isSold: boolean;
    isActive: boolean;
}

export type PurchaseDecision =
    | { buy: number }
    | { refuse: "own-listing" | "already-sold" | "not-for-sale" | "insufficient-balance" };

/**
 * What each side of a sale gets.
 *
 * The cut rounds down, so the remainder goes to the seller rather than to the
 * site: of the two, the one who is surprised by a missing credit is the one
 * who notices.
 */
export function saleSplit(
    price: number,
    commissionPercent: number,
): { price: number; commission: number; toSeller: number } {
    const whole = Math.max(0, Math.floor(price));
    const percent = Number.isFinite(commissionPercent) ? Math.min(100, Math.max(0, commissionPercent)) : 0;
    const commission = Math.min(whole, Math.floor((whole * percent) / 100));
    return { price: whole, commission, toSeller: whole - commission };
}

/** Whether this buyer may take this listing. */
export function purchaseRefusal(
    listing: Listing,
    buyerId: string,
    balance: number,
): PurchaseDecision {
    if (listing.isSold) return { refuse: "already-sold" };
    if (!listing.isActive) return { refuse: "not-for-sale" };

    const price = Math.floor(listing.price);
    // A listing at nothing is a giveaway: no seller to pay and no cut to take.
    if (!Number.isFinite(price) || price <= 0) return { refuse: "not-for-sale" };

    // Buying your own moves nothing except the site's cut, out of the
    // seller's own balance: a way to burn credits that looks like a sale.
    if (listing.sellerId === buyerId) return { refuse: "own-listing" };

    if (!Number.isFinite(balance) || balance < price) return { refuse: "insufficient-balance" };

    return { buy: price };
}
