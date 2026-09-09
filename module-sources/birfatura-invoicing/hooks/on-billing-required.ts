/**
 * Says the checkout has to ask who the invoice is for.
 *
 * Only once a secret has been set. Installed and blank, this would add a tax
 * number to every checkout and nothing would ever read it, because the
 * endpoints that would read it refuse everybody anyway.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { isConfigured } from "../lib/setup";

const onBillingRequired: HookHandlerFor<"store.billing.required", "filter"> = async (required) => {
    if (required) return required;
    return isConfigured();
};

export default onBillingRequired;
