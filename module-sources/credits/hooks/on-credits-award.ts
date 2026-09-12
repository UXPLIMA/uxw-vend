/**
 * The one door credits come in through.
 *
 * The balance and the row that explains it are written in one transaction, so
 * a failure leaves neither. The row's id is derived from the caller's reason
 * and key, which is what makes a retried job an award of nothing rather than a
 * second award: the insert is a duplicate primary key and takes the increment
 * down with it.
 *
 * Reading first and writing after would not close it. Two deliveries arriving
 * together both find no row and both credit the account, which is exactly the
 * bug the store's own credit settlement was written to fix.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { log, prisma } from "@/core/sdk/server";
import { awardLedgerId, awardRefusal } from "../lib/award";
import { moveCredits } from "./change";

const onCreditsAward: HookHandlerFor<"credits.award", "filter"> = async (outcome, request) => {
    if (outcome.handled) return outcome;

    const decision = awardRefusal(request);
    if ("refuse" in decision) {
        return { handled: true, duplicate: false, error: decision.refuse };
    }

    const id = awardLedgerId(request.reason, request.key);

    try {
        // The same movement the in-transaction door makes, in a transaction
        // of its own: one balance, one ledger row, one implementation.
        await prisma.$transaction(async (tx) => {
            await moveCredits(tx, {
                userId: request.userId,
                amount: decision.award,
                type: request.reason,
                description: request.description ?? null,
                ledgerId: id,
            });
        });
    } catch (err) {
        // P2002 is the unique constraint: this award had already been made,
        // and the increment rolled back with it.
        if (err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === "P2002") {
            return { handled: true, duplicate: true, error: null };
        }
        log.error("[credits] an award failed", {
            reason: request.reason,
            error: err instanceof Error ? err.message : String(err),
        });
        return { handled: true, duplicate: false, error: "write-failed" };
    }

    return { handled: true, duplicate: false, error: null };
};

export default onCreditsAward;
