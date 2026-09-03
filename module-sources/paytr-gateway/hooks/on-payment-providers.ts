/** Offers PayTR when it has credentials and can take the currency. */
import type { HookHandlerFor } from "@/core/sdk";
import { isPaytrConfigured, paytrCurrency } from "../lib/paytr";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!paytrCurrency(context.currency)) return providers;
    if (!(await isPaytrConfigured())) return providers;
    return [
        ...providers,
        {
            id: "paytr",
            label: "PayTR",
            description: "Cards, instalments and bank transfer",
            icon: "CreditCard",
        },
    ];
};

export default onPaymentProviders;
