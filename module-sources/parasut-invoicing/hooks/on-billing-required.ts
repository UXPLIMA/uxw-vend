/**
 * Says the checkout has to ask who the invoice is for.
 *
 * Only once an operator has actually set the service up. Installed but not
 * configured, this would add a tax number to every checkout and issue nothing
 * with it, which is the worst of both.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { isConfigured } from "../lib/client";

const onBillingRequired: HookHandlerFor<"store.billing.required", "filter"> = async (required) => {
    if (required) return required;
    return isConfigured();
};

export default onBillingRequired;
