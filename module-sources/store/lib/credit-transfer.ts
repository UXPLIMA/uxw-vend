/**
 * One member sending credits to another.
 *
 * The only path on this site where a balance leaves one account and arrives in
 * a different one on nobody's authority but the sender's. Every way it can be
 * wrong is a way of making credits appear or disappear, so the refusals live
 * here rather than being spread across a route.
 *
 * Two of them look harmless and are not. A negative amount, read as a
 * transfer, is a withdrawal from the recipient made by somebody with no claim
 * on their balance. And a transfer to yourself moves nothing while writing two
 * ledger rows that say it did, which is the shape used to make a balance look
 * earned.
 *
 * The balance check here is not the one that protects the money. It is the one
 * that gives the sender a sentence to read; the write does it again inside its
 * own transaction, because a check before a transaction is a snapshot and two
 * sends of the whole balance arriving together both pass it.
 */

export interface TransferRequest {
    fromUserId: string;
    toUserId: string;
    amount: number;
    /** What the sender holds, as it was a moment ago. */
    balance: number;
}

export type TransferDecision =
    | { send: number }
    | { refuse: "no-recipient" | "same-account" | "amount-not-positive" | "insufficient-balance" };

/**
 * Whether to move the credits.
 *
 * The refusals come in the order a sender can act on them: who it is for is
 * the box they are looking at, then how much, then whether they have it.
 */
export function transferRefusal(request: TransferRequest): TransferDecision {
    const to = request.toUserId.trim();
    if (to === "") return { refuse: "no-recipient" };
    if (to === request.fromUserId.trim()) return { refuse: "same-account" };

    const amount = request.amount;
    // Whole and positive. A fraction is not a count of credits, and anything
    // below one is a request that cannot move a balance.
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
        return { refuse: "amount-not-positive" };
    }

    if (!Number.isFinite(request.balance) || amount > request.balance) {
        return { refuse: "insufficient-balance" };
    }

    return { send: amount };
}
