/** A gateway says the money went back. */
import type { HookHandlerFor } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { refundPayment } from "../lib/fulfilment";

const onPaymentRefunded: HookHandlerFor<"payment.refunded", "filter"> = async (outcome, event) => {
    if (outcome.handled) return outcome;
    try {
        return await refundPayment(event.provider, event.providerRef);
    } catch (error) {
        log.error("[store] could not record a refund", {
            provider: event.provider,
            providerRef: event.providerRef,
            error: error instanceof Error ? error.message : String(error),
        });
        return { handled: false, duplicate: false, error: "refund failed" };
    }
};

export default onPaymentRefunded;
