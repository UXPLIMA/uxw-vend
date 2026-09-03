/**
 * Creates a paysafecard payment and sends the buyer to the voucher page.
 *
 * The store reference travels as the correlation id, which paysafecard echoes
 * on every read, and the notification URL carries the payment id: those two
 * are what the notification route needs to find the order again.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { log, resolveAppUrl } from "@/core/sdk/server";
import { callPaysafecard, getPaysafecardConfig } from "../lib/paysafecard";

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "paysafecard") return result;

    const config = await getPaysafecardConfig();
    if (!config) return result;

    // A voucher is spent once. There is no mandate to bill again.
    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "paysafecard cannot be used for a subscription. Pay another way.",
        };
    }

    try {
        const baseUrl = await resolveAppUrl();
        const payment = await callPaysafecard(config, "/payments", {
            method: "POST",
            body: {
                type: "PAYSAFECARD",
                amount: Number(request.amount.toFixed(2)),
                currency: request.currency,
                redirect: { success_url: request.successUrl, failure_url: request.cancelUrl },
                // paysafecard substitutes the placeholder with the payment id.
                notification_url: `${baseUrl}/api/v1/paysafecard/notify?payment_id={payment_id}`,
                customer: { id: request.customer.userId ?? request.reference },
                correlation_id: request.reference,
            },
        });

        const authUrl = payment.redirect?.auth_url;
        if (!authUrl) {
            log.error("[paysafecard-gateway] paysafecard returned no authorisation URL", {
                reference: request.reference,
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The paysafecard payment could not be started. Try again shortly.",
            };
        }

        return { handled: true, redirectUrl: authUrl, reference: payment.id ?? null, error: null };
    } catch (error) {
        log.error("[paysafecard-gateway] could not create a payment", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The paysafecard payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
