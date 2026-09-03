/**
 * Adds Stripe to the list of ways this site can take money, when it is
 * actually configured. An unconfigured gateway offers nothing: a button that
 * fails after the buyer clicks it is worse than no button.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { getStripeEnabled } from "../lib/stripe";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers) => {
    if (!(await getStripeEnabled())) return providers;
    return [
        ...providers,
        {
            id: "stripe",
            label: "Card",
            description: "Credit and debit cards, Apple Pay and Google Pay",
            icon: "CreditCard",
        },
    ];
};

export default onPaymentProviders;
