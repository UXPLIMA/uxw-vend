/**
 * Starts a PayPal order and hands back the approval URL.
 *
 * PayPal has no webhook in this flow: the buyer comes back through the return
 * URL, and the capture route there is what reports the payment. Where to send
 * them afterwards is written to a row rather than into that URL, because a URL
 * the buyer can edit is a URL the buyer can point anywhere.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { prisma, log, resolveAppUrl, resolveAppName } from "@/core/sdk/server";
import { createPaypalOrder, getPaypalEnabled } from "../lib/paypal";

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "paypal") return result;
    if (!(await getPaypalEnabled())) return result;

    // PayPal bills a plan through its Subscriptions API, which is a different
    // integration. Saying so beats charging once for something sold monthly.
    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "PayPal cannot take subscriptions on this site yet. Pay by card instead.",
        };
    }

    try {
        const baseUrl = await resolveAppUrl();
        const order = await createPaypalOrder({
            amount: request.amount,
            currency: request.currency,
            reference: request.reference,
            brandName: await resolveAppName(),
            returnUrl: `${baseUrl}/api/v1/paypal/capture`,
            cancelUrl: request.cancelUrl,
        });

        if (!order.approveUrl) {
            return { handled: true, redirectUrl: null, reference: null, error: "PayPal did not return an approval link." };
        }

        await prisma.paypalPayment.create({
            data: {
                paypalOrderId: order.id,
                reference: request.reference,
                kind: request.kind,
                amount: request.amount,
                currency: request.currency,
                successUrl: request.successUrl,
                cancelUrl: request.cancelUrl,
                metadata: request.metadata,
            },
        });

        return { handled: true, redirectUrl: order.approveUrl, reference: order.id, error: null };
    } catch (error) {
        log.error("[paypal-gateway] could not start a PayPal order", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The PayPal payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
