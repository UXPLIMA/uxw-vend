/**
 * The credit contract.
 *
 * Anything on this site can put credits into an account, and none of it should
 * write a balance itself: an increment without the ledger row beside it in the
 * same transaction leaves a balance nothing accounts for, which is what a
 * credit history exists to prevent. So there is one door, and it is a filter
 * rather than an action because the caller needs the answer - a job that
 * cannot tell "awarded" from "already awarded" from "refused" has no way to
 * decide whether to try again.
 */
declare global {
    interface UxwVendFilterPayloads {
        /** Whether the credits went in, and whether they had already. */
        "credits.award": CreditAwardOutcome;
    }

    interface UxwVendFilterContexts {
        "credits.award": CreditAwardRequest;
    }

    interface CreditAwardRequest {
        userId: string;
        /** Whole credits, more than none. */
        amount: number;
        /**
         * What happened, in one word. It groups the history and it is half of
         * what makes the award happen once.
         */
        reason: string;
        /**
         * Which one it was, unique within the reason: an order id, a post id,
         * a date. The ledger row's id is derived from the pair, so a second
         * attempt is a duplicate key rather than a second award.
         */
        key: string;
        /** A sentence for the member's history. */
        description?: string;
    }

    interface CreditAwardOutcome {
        /** False when nothing answered, which means the module is not installed. */
        handled: boolean;
        /** True when this exact award had already been made. */
        duplicate: boolean;
        /** Why it was refused, or null when it was not. */
        error: string | null;
    }
}

export {};
