/**
 * One way to put credits into an account, for anything that needs to.
 *
 * Cashback is the first and will not be the last: a forum rewarding a first
 * post, a vote that pays for itself, a referral that pays out. Left to
 * themselves each of those writes its own balance increment and its own ledger
 * row, and the first one to forget the transaction leaves a balance nothing
 * accounts for - the single thing a credit history exists to prevent.
 *
 * What a caller brings is a key. The ledger row is written with an id derived
 * from it, so a second attempt is a duplicate primary key rather than a second
 * award: every one of these triggers fires more than once in normal operation,
 * whether from a retried callback, a job that ran twice, or an operator
 * repeating something by hand.
 */
import crypto from "crypto";

export interface AwardRequest {
    userId: string;
    amount: number;
    /** What happened, in the word the history is grouped by. */
    reason: string;
    /** Which one it was. Unique within the reason. */
    key: string;
}

export type AwardDecision =
    | { award: number }
    | { refuse: "no-member" | "no-reason" | "no-key" | "amount-not-positive" };

export function awardRefusal(request: AwardRequest): AwardDecision {
    if (request.userId.trim() === "") return { refuse: "no-member" };
    // A row saying a balance went up and not why is what this ledger exists
    // to avoid.
    if (request.reason.trim() === "") return { refuse: "no-reason" };
    if (request.key.trim() === "") return { refuse: "no-key" };

    const amount = request.amount;
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
        return { refuse: "amount-not-positive" };
    }

    return { award: amount };
}

/**
 * The ledger id that makes an award happen once.
 *
 * Hashed rather than joined. A key is whatever the caller had to hand - an
 * order id, a post id, a date - so it can be any length and can contain the
 * separator itself, and `"a" + "b:c"` colliding with `"a:b" + "c"` would let
 * one module's award silently swallow another's. The lengths go in with it,
 * so no two different pairs can produce the same input.
 */
export function awardLedgerId(reason: string, key: string): string {
    const material = `${reason.length}:${reason}:${key.length}:${key}`;
    return `cr_${crypto.createHash("sha256").update(material).digest("hex").slice(0, 40)}`;
}
