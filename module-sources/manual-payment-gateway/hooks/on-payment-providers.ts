/** Offers paying by hand once an operator has written how, and in a currency they bank in. */
import type { HookHandlerFor } from "@/core/sdk";
import { offersManualPayment } from "../lib/manual-payment";
import { manualPaymentSetup } from "../lib/setup";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    const setup = await manualPaymentSetup();
    if (!offersManualPayment(setup, context.currency)) return providers;
    return [
        ...providers,
        {
            id: "manual-payment",
            label: "Bank transfer",
            description: "Send the money yourself and we will confirm it",
            icon: "Landmark",
        },
    ];
};

export default onPaymentProviders;
