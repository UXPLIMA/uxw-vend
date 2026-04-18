import { prisma } from "@/core/lib/db";

/**
 * Stripe inbound webhook handler.
 *
 * Signature verification is performed by the core dispatcher at
 * /api/v1/webhook/[provider] using the shared HMAC helper before this
 * handler is invoked. The core route re-creates the Request with the raw
 * body so we can safely parse JSON here.
 *
 * Note: Stripe's own signature scheme uses a timestamped format
 * (`t=...,v1=...`) that differs from plain HMAC-SHA256 hex. The generic
 * HMAC helper in core covers the common case; for full parity with the
 * Stripe SDK verify, a dedicated Stripe-specific verifier can be added
 * later.
 */
export default async function handleWebhook(
    request: Request
): Promise<{ status: number; body?: unknown }> {
    let event: { id?: string; type?: string; data?: unknown } = {};
    try {
        event = await request.json();
    } catch {
        return { status: 400, body: { error: "Invalid JSON" } };
    }

    const eventType = typeof event.type === "string" ? event.type : "stripe.unknown";

    try {
        await prisma.webhookLog.create({
            data: {
                event: eventType,
                url: request.url,
                status: 200,
                payload: event as object,
            },
        });
    } catch (err) {
        console.error("[stripe-gateway] failed to log webhook:", err);
    }

    // TODO: Route specific events (checkout.session.completed,
    // payment_intent.succeeded, invoice.paid, etc.) into store module
    // order/subscription updates. The stripe-gateway module is metadata-
    // only right now, so we just acknowledge the event.

    return { status: 200, body: { received: true, event: eventType } };
}
