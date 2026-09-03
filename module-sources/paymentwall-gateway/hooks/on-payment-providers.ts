/** Offers Paymentwall's local methods once the project keys are set. */
import type { HookHandlerFor } from "@/core/sdk";
import { isPaymentwallConfigured, PAYMENTWALL_CURRENCIES } from "../lib/paymentwall";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!PAYMENTWALL_CURRENCIES.has(context.currency)) return providers;
    if (!(await isPaymentwallConfigured())) return providers;
    return [
        ...providers,
        {
            id: "paymentwall",
            label: "Paymentwall",
            description: "Local payment methods, wallets and mobile billing",
            icon: "Globe",
        },
    ];
};

export default onPaymentProviders;
