/** Offers Razorpay (UPI, cards, netbanking) when its keys are set. */
import type { HookHandlerFor } from "@/core/sdk";
import { isRazorpayConfigured, RAZORPAY_CURRENCIES } from "../lib/razorpay";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!RAZORPAY_CURRENCIES.has(context.currency)) return providers;
    if (!(await isRazorpayConfigured())) return providers;
    return [
        ...providers,
        {
            id: "razorpay",
            label: "Razorpay",
            description: "UPI, cards, netbanking and wallets",
            icon: "Smartphone",
        },
    ];
};

export default onPaymentProviders;
