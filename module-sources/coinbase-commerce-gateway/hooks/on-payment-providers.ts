/** Offers crypto through Coinbase Commerce when an API key is set. */
import type { HookHandlerFor } from "@/core/sdk";
import { COINBASE_CURRENCIES, isCoinbaseConfigured } from "../lib/coinbase";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!COINBASE_CURRENCIES.has(context.currency)) return providers;
    if (!(await isCoinbaseConfigured())) return providers;
    return [
        ...providers,
        {
            id: "coinbase-commerce",
            label: "Crypto (Coinbase Commerce)",
            description: "Bitcoin, Ethereum, USDC and more",
            icon: "Bitcoin",
        },
    ];
};

export default onPaymentProviders;
