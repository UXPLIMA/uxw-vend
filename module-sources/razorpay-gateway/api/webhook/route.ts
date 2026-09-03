/**
 * What Razorpay says about a payment link.
 *
 * The buyer is redirected back the moment the link is paid, but the redirect
 * is not proof of anything: only this webhook, signed with the account's
 * webhook secret, settles an order.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { applyFiltersAsync } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { getRazorpayConfig } from "../../lib/razorpay";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

interface RazorpayEvent {
    event?: string;
    payload?: {
        payment_link?: { entity?: { id?: string; notes?: Record<string, string>; amount?: number; currency?: string } };
        payment?: { entity?: { id?: string; notes?: Record<string, string>; amount?: number; currency?: string } };
        refund?: { entity?: { payment_id?: string; amount?: number } };
    };
}

function signatureMatches(secret: string, body: string, received: string): boolean {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    const config = await getRazorpayConfig();
    if (!config?.webhookSecret) {
        return NextResponse.json({ error: "Razorpay webhooks are not configured" }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature || !signatureMatches(config.webhookSecret, body, signature)) {
        log.error("[razorpay-gateway] a webhook arrived with a bad signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body) as RazorpayEvent;

    if (event.event === "payment_link.paid" || event.event === "payment.captured") {
        const link = event.payload?.payment_link?.entity;
        const payment = event.payload?.payment?.entity;
        const notes = link?.notes ?? payment?.notes ?? {};
        const reference = notes.reference;
        if (!reference) return NextResponse.json({ received: true });

        const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind: notes.kind === "credits" ? "credits" : "order",
            reference,
            provider: "razorpay",
            providerRef: payment?.id ?? link?.id ?? reference,
            // Razorpay counts in paise.
            amount: (payment?.amount ?? link?.amount ?? 0) / 100,
            currency: payment?.currency ?? link?.currency ?? "INR",
            metadata: notes,
        });

        if (!outcome.handled) {
            log.error("[razorpay-gateway] nothing settled a paid link", { reference });
            // Razorpay retries a webhook that did not answer 2xx.
            return NextResponse.json({ error: "unhandled" }, { status: 500 });
        }
        return NextResponse.json({ received: true });
    }

    if (event.event === "refund.processed") {
        const refund = event.payload?.refund?.entity;
        if (refund?.payment_id) {
            const outcome = await applyFiltersAsync("payment.refunded", UNHANDLED, {
                provider: "razorpay",
                providerRef: refund.payment_id,
                amount: (refund.amount ?? 0) / 100,
            });
            if (!outcome.handled) log.warn("[razorpay-gateway] nothing recorded a refund", { paymentId: refund.payment_id });
        }
        return NextResponse.json({ received: true });
    }

    if (event.event === "payment_link.cancelled" || event.event === "payment_link.expired") {
        const notes = event.payload?.payment_link?.entity?.notes ?? {};
        if (notes.reference) {
            const outcome = await applyFiltersAsync("payment.voided", UNHANDLED, {
                kind: notes.kind === "credits" ? "credits" : "order",
                reference: notes.reference,
                provider: "razorpay",
            });
            if (!outcome.handled) log.warn("[razorpay-gateway] nothing cancelled an expired link", { reference: notes.reference });
        }
    }

    return NextResponse.json({ received: true });
}
