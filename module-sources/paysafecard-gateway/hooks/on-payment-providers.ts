/** Offers paysafecard, the prepaid voucher, when a key is configured. */
import type { HookHandlerFor } from "@/core/sdk";
import { isPaysafecardConfigured, PAYSAFECARD_CURRENCIES } from "../lib/paysafecard";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!PAYSAFECARD_CURRENCIES.has(context.currency)) return providers;
    if (!(await isPaysafecardConfigured())) return providers;
    return [
        ...providers,
        {
            id: "paysafecard",
            label: "paysafecard",
            description: "Pay with a prepaid voucher, no bank account needed",
            icon: "Ticket",
        },
    ];
};

export default onPaymentProviders;
