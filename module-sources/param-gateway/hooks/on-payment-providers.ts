/** Offers Param for Turkish lira orders, once its terminal is configured. */
import type { HookHandlerFor } from "@/core/sdk";
import { isParamConfigured } from "../lib/param";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    // Param settles in Turkish lira only.
    if (context.currency !== "TRY") return providers;
    if (!(await isParamConfigured())) return providers;
    return [
        ...providers,
        { id: "param", label: "Param", description: "Turkish cards and instalments", icon: "CreditCard" },
    ];
};

export default onPaymentProviders;
