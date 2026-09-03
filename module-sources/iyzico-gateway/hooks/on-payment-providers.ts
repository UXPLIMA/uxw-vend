/** Offers iyzico when it has keys and the order is in a currency it settles. */
import type { HookHandlerFor } from "@/core/sdk";
import { isIyzicoConfigured, IYZICO_CURRENCIES } from "../lib/iyzico";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!IYZICO_CURRENCIES.has(context.currency)) return providers;
    if (!(await isIyzicoConfigured())) return providers;
    return [
        ...providers,
        {
            id: "iyzico",
            label: "iyzico",
            description: "Cards, instalments and 3D Secure",
            icon: "CreditCard",
        },
    ];
};

export default onPaymentProviders;
