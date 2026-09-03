/** Offers CoinPayments once a merchant id and an IPN secret are both set. */
import type { HookHandlerFor } from "@/core/sdk";
import { COINPAYMENTS_CURRENCIES, isCoinPaymentsConfigured } from "../lib/coinpayments";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!COINPAYMENTS_CURRENCIES.has(context.currency)) return providers;
    if (!(await isCoinPaymentsConfigured())) return providers;
    return [
        ...providers,
        {
            id: "coinpayments",
            label: "Crypto (CoinPayments)",
            description: "Bitcoin, Litecoin, USDT and more",
            icon: "Bitcoin",
        },
    ];
};

export default onPaymentProviders;
