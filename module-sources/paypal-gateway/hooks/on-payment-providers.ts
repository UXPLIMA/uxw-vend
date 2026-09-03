/** Offers PayPal only when it is actually configured. */
import type { HookHandlerFor } from "@/core/sdk";
import { getPaypalEnabled } from "../lib/paypal";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers) => {
    if (!(await getPaypalEnabled())) return providers;
    return [
        ...providers,
        { id: "paypal", label: "PayPal", description: "Pay with a PayPal balance or a linked card", icon: "Wallet" },
    ];
};

export default onPaymentProviders;
