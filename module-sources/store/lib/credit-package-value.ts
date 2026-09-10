/**
 * What a credit costs, once the bonus is counted.
 *
 * A package is three numbers an operator types separately - credits, bonus and
 * price - and the number that matters is none of them. The bonus never reaches
 * the charge, so 1000 credits with 200 on top is 1200 for the price of 1000,
 * and comparing two packages means working that out for both.
 *
 * Nobody does it by hand, and the mistake a ladder of packages produces over
 * and over is a bigger package that is worse value than a smaller one. Raise
 * the bonus on the middle tier, or round a price up, and the top package
 * quietly becomes the wrong thing to buy. The buyer who notices feels cheated,
 * the one who does not is overcharged, and the operator hears from neither.
 *
 * So it is worked out here and said on the screen before the save. Compared
 * only against packages actually on sale, because a retired one is not an
 * offer, and only against cheaper ones, because paying less for less is the
 * ladder working as intended.
 */

export interface PricedPackage {
    id: string;
    credits: number;
    bonusCredits: number;
    /** A `Decimal` column reaches a client as a string. */
    price: number | string;
    isActive: boolean;
}

function asNumber(value: number | string): number | null {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/** Credits received per unit of currency, or null when there is no price. */
export function creditsPerUnit(pack: PricedPackage): number | null {
    const price = asNumber(pack.price);
    if (price === null || price <= 0) return null;
    const given = asNumber(pack.credits + pack.bonusCredits);
    if (given === null) return null;
    return given / price;
}

/**
 * The ids of packages a cheaper one beats on value.
 *
 * Strictly beats: two packages at the same rate are a choice between sizes,
 * not a mistake.
 */
export function poorValue(packs: readonly PricedPackage[]): string[] {
    const rated = packs
        .filter((pack) => pack.isActive)
        .map((pack) => ({ pack, price: asNumber(pack.price), rate: creditsPerUnit(pack) }))
        .filter((row): row is { pack: PricedPackage; price: number; rate: number } =>
            row.price !== null && row.price > 0 && row.rate !== null);

    return rated
        .filter((row) => rated.some((other) => other.price < row.price && other.rate > row.rate))
        .map((row) => row.pack.id);
}
