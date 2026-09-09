/**
 * How long a purchase lasts.
 *
 * A product could only be owned outright. Everything a shop sells as access -
 * a rank, a membership, a tier - has an end date, and the only way to sell one
 * here was a Stripe subscription, which ties the shape of the offer to the
 * processor that happens to be configured. A shop taking bank transfers could
 * not sell thirty days of anything.
 *
 * The duration lives on the product and the end date lives on the ownership,
 * so the arithmetic is the same whoever took the money.
 */

/**
 * The end date after buying `days` of something, given what is left of it.
 *
 * Extending rather than replacing is the whole rule. Somebody with twenty days
 * left who buys thirty more has fifty; replacing the date would take ten days
 * off a paying customer and they would find out about it a week later.
 *
 * A lapsed date is not extended - it starts again from the purchase - because
 * adding thirty days to an end date eleven months old sells nothing at all.
 *
 * No duration means owned outright, and that outranks any date: once somebody
 * owns a thing, a later timed purchase cannot put an end on it.
 */
export function extendedExpiry(current: Date | null, days: number | null, at: Date): Date | null {
    if (days === null || !Number.isFinite(days) || days < 1) return null;
    const whole = Math.floor(days);
    const from = current && current > at ? current : at;
    return new Date(from.getTime() + whole * 86_400_000);
}

/**
 * The rows that still count as owned, as a Prisma filter.
 *
 * Written as a filter rather than a check applied afterwards because every
 * caller that reads ownership has to apply it, and one that forgets goes on
 * crediting an upgrade against a rank that lapsed in 2024. Put in the `where`,
 * the rule is impossible to leave out.
 */
export function stillOwnedWhere(userId: string, at: Date) {
    return {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
    };
}
