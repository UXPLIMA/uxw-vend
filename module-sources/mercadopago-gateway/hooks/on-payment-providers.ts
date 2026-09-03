/** Offers Mercado Pago in the currencies it settles, once a token is set. */
import type { HookHandlerFor } from "@/core/sdk";
import { isMercadoPagoConfigured, MERCADOPAGO_CURRENCIES } from "../lib/mercadopago";

const onPaymentProviders: HookHandlerFor<"payment.providers", "filter"> = async (providers, context) => {
    if (!MERCADOPAGO_CURRENCIES.has(context.currency)) return providers;
    if (!(await isMercadoPagoConfigured())) return providers;
    return [
        ...providers,
        {
            id: "mercadopago",
            label: "Mercado Pago",
            description: "Cards, Pix, boleto and cash payments",
            icon: "Wallet",
        },
    ];
};

export default onPaymentProviders;
