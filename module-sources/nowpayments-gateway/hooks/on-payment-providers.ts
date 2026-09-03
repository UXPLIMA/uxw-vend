/** Offers crypto through NOWPayments when an API key is set. */
import type { HookHandlerFor } from "@/core/sdk";
import { isNowPaymentsConfigured, NOWPAYMENTS_CURRENCIES } from "../lib/nowpayments";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!NOWPAYMENTS_CURRENCIES.has(context.currency)) return providers;
    if (!(await isNowPaymentsConfigured())) return providers;
    return [
        ...providers,
        {
            id: "nowpayments",
            label: "Crypto (NOWPayments)",
            description: "Pay with any of 200+ coins",
            icon: "Bitcoin",
        },
    ];
};

export default onPaymentProviders;
