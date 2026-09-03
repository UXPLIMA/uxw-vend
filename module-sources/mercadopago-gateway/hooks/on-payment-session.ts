/** Creates a Checkout Pro preference and sends the buyer to it. */
import type { HookHandlerFor } from "@/core/sdk";
import { log, resolveAppUrl } from "@/core/sdk/server";
import { getMercadoPagoConfig, MERCADOPAGO_API } from "../lib/mercadopago";

interface Preference {
    id?: string;
    init_point?: string;
    message?: string;
}

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "mercadopago") return result;

    const config = await getMercadoPagoConfig();
    if (!config) return result;

    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "Mercado Pago subscriptions are not set up on this site yet. Pay another way.",
        };
    }

    try {
        const baseUrl = await resolveAppUrl();
        // The lines are shown to the buyer; the total charged is their sum, so
        // a discount that lives only in the order total travels as one line.
        const linesTotal = request.lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
        const items =
            Math.abs(linesTotal - request.amount) < 0.01
                ? request.lines.map((line) => ({
                      title: line.name.slice(0, 200),
                      quantity: line.quantity,
                      unit_price: Number(line.unitAmount.toFixed(2)),
                      currency_id: request.currency,
                  }))
                : [
                      {
                          title: request.description.slice(0, 200),
                          quantity: 1,
                          unit_price: Number(request.amount.toFixed(2)),
                          currency_id: request.currency,
                      },
                  ];

        const response = await fetch(`${MERCADOPAGO_API}/checkout/preferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.accessToken}` },
            body: JSON.stringify({
                items,
                payer: {
                    email: request.customer.email ?? undefined,
                    name: request.customer.name ?? undefined,
                },
                back_urls: {
                    success: request.successUrl,
                    failure: request.cancelUrl,
                    pending: request.successUrl,
                },
                auto_return: "approved",
                // The reference comes back on the payment, which is what the
                // webhook looks up.
                external_reference: request.reference,
                metadata: { ...request.metadata, kind: request.kind },
                notification_url: `${baseUrl}/api/v1/mercadopago/webhook`,
            }),
        });

        const preference = (await response.json()) as Preference;
        if (!response.ok || !preference.init_point) {
            log.error("[mercadopago-gateway] Mercado Pago refused to create a preference", {
                reference: request.reference,
                error: preference.message ?? String(response.status),
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The Mercado Pago payment could not be started. Try again shortly.",
            };
        }

        return { handled: true, redirectUrl: preference.init_point, reference: preference.id ?? null, error: null };
    } catch (error) {
        log.error("[mercadopago-gateway] could not create a preference", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The Mercado Pago payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
