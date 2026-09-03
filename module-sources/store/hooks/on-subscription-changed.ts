/** A gateway reports that a recurring plan started, renewed or ended. */
import type { HookHandlerFor } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { applySubscriptionChange } from "../lib/fulfilment";

const onSubscriptionChanged: HookHandlerFor<"subscription.changed", "filter"> = async (outcome, change) => {
    if (outcome.handled) return outcome;
    try {
        return await applySubscriptionChange(change);
    } catch (error) {
        log.error("[store] could not record a subscription change", {
            provider: change.provider,
            providerRef: change.providerRef,
            error: error instanceof Error ? error.message : String(error),
        });
        return { handled: false, duplicate: false, error: "subscription update failed" };
    }
};

export default onSubscriptionChanged;
