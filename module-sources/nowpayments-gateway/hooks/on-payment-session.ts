/** Creates a NOWPayments invoice and sends the buyer to it. */
import type { HookHandlerFor } from "@/core/sdk";
import { log, resolveAppUrl } from "@/core/sdk/server";
import { getNowPaymentsConfig, NOWPAYMENTS_API } from "../lib/nowpayments";

interface InvoiceResponse {
    id?: string;
    invoice_url?: string;
    message?: string;
}

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "nowpayments") return result;

    const config = await getNowPaymentsConfig();
    if (!config) return result;

    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "Crypto cannot be used for a subscription. Pay by card instead.",
        };
    }

    try {
        const baseUrl = await resolveAppUrl();
        const response = await fetch(`${NOWPAYMENTS_API}/invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": config.apiKey },
            body: JSON.stringify({
                price_amount: Number(request.amount.toFixed(2)),
                price_currency: request.currency.toLowerCase(),
                // The order id is the only thing that comes back on the IPN,
                // so it carries the reference and nothing else has to.
                order_id: request.reference,
                order_description: request.description.slice(0, 200),
                ipn_callback_url: `${baseUrl}/api/v1/nowpayments/ipn`,
                success_url: request.successUrl,
                cancel_url: request.cancelUrl,
            }),
        });

        const invoice = (await response.json()) as InvoiceResponse;
        if (!response.ok || !invoice.invoice_url) {
            log.error("[nowpayments-gateway] NOWPayments refused to create an invoice", {
                reference: request.reference,
                error: invoice.message ?? String(response.status),
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The crypto payment could not be started. Try again shortly.",
            };
        }

        return { handled: true, redirectUrl: invoice.invoice_url, reference: invoice.id ?? null, error: null };
    } catch (error) {
        log.error("[nowpayments-gateway] could not create an invoice", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The crypto payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
