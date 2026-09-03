/** A gateway says the buyer never paid: session expired, or they backed out. */
import type { HookHandlerFor } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { voidOrder } from "../lib/fulfilment";

const onPaymentVoided: HookHandlerFor<"payment.voided", "filter"> = async (outcome, event) => {
    if (outcome.handled) return outcome;
    // A wallet top-up that was never paid for leaves nothing behind to undo.
    if (event.kind !== "order") return { handled: true, duplicate: false, error: null };

    try {
        return await voidOrder(event.reference);
    } catch (error) {
        log.error("[store] could not cancel an abandoned order", {
            reference: event.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return { handled: false, duplicate: false, error: "cancellation failed" };
    }
};

export default onPaymentVoided;
