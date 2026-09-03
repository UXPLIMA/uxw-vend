/** Offers Mollie (iDEAL, cards, Bancontact and the rest) when it has a key. */
import type { HookHandlerFor } from "@/core/sdk";
import { isMollieConfigured, MOLLIE_CURRENCIES } from "../lib/mollie";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!MOLLIE_CURRENCIES.has(context.currency)) return providers;
    if (!(await isMollieConfigured())) return providers;
    return [
        ...providers,
        {
            id: "mollie",
            label: "Mollie",
            description: "iDEAL, Bancontact, SEPA and cards",
            icon: "Landmark",
        },
    ];
};

export default onPaymentProviders;
