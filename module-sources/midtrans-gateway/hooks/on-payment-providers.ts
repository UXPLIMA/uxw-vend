/** Offers Midtrans for rupiah orders, once a server key is set. */
import type { HookHandlerFor } from "@/core/sdk";
import { isMidtransConfigured } from "../lib/midtrans";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    // Midtrans settles in Indonesian rupiah only.
    if (context.currency !== "IDR") return providers;
    if (!(await isMidtransConfigured())) return providers;
    return [
        ...providers,
        {
            id: "midtrans",
            label: "Midtrans",
            description: "Bank transfer, e-wallets, convenience store and cards",
            icon: "Smartphone",
        },
    ];
};

export default onPaymentProviders;
