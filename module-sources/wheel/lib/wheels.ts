/**
 * What a wheel is, beyond a list of prizes.
 *
 * There was one wheel. It was free, it turned once a day for everybody, and
 * an extra turn cost a number in a module setting - which is a reasonable
 * shape for exactly one community and no shape at all for the rest. A daily
 * free wheel for everyone and a weekly wheel for the people who bought a rank
 * are two different wheels, not two settings on one, and the moment a second
 * wheel exists the cooldown, the price and who may reach it all belong to the
 * wheel rather than to the module.
 */

/** How often one person may turn a given wheel. */
export const WHEEL_COOLDOWNS = ["none", "daily", "weekly", "monthly", "custom"] as const;

export type WheelCooldown = (typeof WHEEL_COOLDOWNS)[number];

export interface WheelRules {
    cooldown: string;
    /** Hours between turns when the cooldown is `custom`. */
    cooldownHours: number;
    /** What one turn costs in credits. Zero is free. */
    cost: number;
    /** Role ids that may turn it. Empty means anyone with an account. */
    roleIds: string[];
    isActive: boolean;
}

/** Hours in each named cooldown; `custom` carries its own. */
const HOURS: Record<string, number> = {
    none: 0,
    daily: 24,
    weekly: 24 * 7,
    monthly: 24 * 30,
};

export function cooldownHoursOf(rules: Pick<WheelRules, "cooldown" | "cooldownHours">): number {
    if (rules.cooldown === "custom") return Math.max(0, rules.cooldownHours);
    return HOURS[rules.cooldown] ?? 0;
}

/**
 * When this person may turn this wheel again.
 *
 * Measured from their last turn rather than from a calendar boundary: a daily
 * wheel that resets at midnight is a wheel everyone turns twice in five
 * minutes on either side of it.
 */
export function nextTurnAt(
    rules: Pick<WheelRules, "cooldown" | "cooldownHours">,
    lastTurn: Date | null,
): Date | null {
    const hours = cooldownHoursOf(rules);
    if (!lastTurn || hours <= 0) return null;
    return new Date(lastTurn.getTime() + hours * 3_600_000);
}

export type Refusal =
    | "signed_out"
    | "wheel_off"
    | "wrong_role"
    | "too_soon"
    | "not_enough_credits"
    | null;

export interface Turner {
    signedIn: boolean;
    roleId: string | null;
    credits: number;
    lastTurn: Date | null;
}

/**
 * Why this person cannot turn this wheel, or null when they can.
 *
 * One function, so the page that draws the button, the endpoint that refuses
 * the request and the test that pins the rules cannot drift into three
 * different answers - which is how a disabled button and a working endpoint
 * end up in the same release.
 */
export function refusalFor(rules: WheelRules, turner: Turner, now: Date = new Date()): Refusal {
    if (!rules.isActive) return "wheel_off";
    if (!turner.signedIn) return "signed_out";
    if (rules.roleIds.length > 0 && (!turner.roleId || !rules.roleIds.includes(turner.roleId))) {
        return "wrong_role";
    }
    const next = nextTurnAt(rules, turner.lastTurn);
    if (next && next > now) return "too_soon";
    if (rules.cost > 0 && turner.credits < rules.cost) return "not_enough_credits";
    return null;
}

/**
 * The prize a turn lands on.
 *
 * Weighted, and the weights are the operator's: zero is how a prize is
 * switched off without deleting it. All of them zero is not an error to
 * divide by - it is a wheel with nothing on it, which the caller has to say
 * differently from a wheel with no prizes at all.
 */
export function drawPrize<T extends { probability: number }>(
    prizes: T[],
    roll: (max: number) => number,
): T | null {
    const total = prizes.reduce((sum, prize) => sum + Math.max(0, prize.probability), 0);
    if (total <= 0) return null;

    // Accumulate rather than subtract. Subtracting and testing `<= 0` hands
    // the turn to a prize with odds of zero whenever the roll lands exactly on
    // zero - which is the one prize an operator has switched off, and the one
    // that must never come up. Rare enough to survive a long time unnoticed,
    // which is why it is written down here.
    const point = roll(Math.ceil(total * 1000)) / 1000;
    let reached = 0;
    for (const prize of prizes) {
        reached += Math.max(0, prize.probability);
        if (point < reached) return prize;
    }
    return prizes[prizes.length - 1] ?? null;
}
