/** Creates a Razorpay Payment Link and sends the buyer to it. */
import type { HookHandlerFor } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { getRazorpayConfig, RAZORPAY_API, RazorpayPaymentLink, razorpayAuth } from "../lib/razorpay";

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "razorpay") return result;

    const config = await getRazorpayConfig();
    if (!config) return result;

    // Razorpay bills a plan through Subscriptions, against a saved mandate.
    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "Razorpay cannot take subscriptions on this site yet. Pay another way.",
        };
    }

    try {
        const response = await fetch(`${RAZORPAY_API}/payment_links`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: razorpayAuth(config) },
            body: JSON.stringify({
                amount: Math.round(request.amount * 100),
                currency: request.currency,
                description: request.description.slice(0, 200),
                customer: {
                    name: request.customer.name ?? undefined,
                    email: request.customer.email ?? undefined,
                },
                // The store, not Razorpay, tells the buyer their order is
                // ready; a reminder email about a paid link is confusing.
                notify: { sms: false, email: false },
                reminder_enable: false,
                // Notes come back on the webhook, which is where the order is
                // recognised.
                notes: { ...request.metadata, reference: request.reference, kind: request.kind },
                callback_url: request.successUrl,
                callback_method: "get",
            }),
        });

        const link = (await response.json()) as RazorpayPaymentLink;
        if (!response.ok || !link.short_url) {
            log.error("[razorpay-gateway] Razorpay refused to create a payment link", {
                reference: request.reference,
                error: link.error?.description ?? String(response.status),
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The Razorpay payment could not be started. Try again shortly.",
            };
        }

        return { handled: true, redirectUrl: link.short_url, reference: link.id ?? null, error: null };
    } catch (error) {
        log.error("[razorpay-gateway] could not create a payment link", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The Razorpay payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
