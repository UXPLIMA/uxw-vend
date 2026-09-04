/**
 * What Midtrans says about a Snap transaction.
 *
 * A card payment can arrive as "capture" with a fraud status still pending
 * review; only an accepted capture, or a settlement, means the money is ours.
 * Anything else is recorded as unpaid rather than granted.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { applyFiltersAsync } from "@/core/sdk";
import { log, readJsonBody } from "@/core/sdk/server";
import { fromOrderId, getMidtransConfig, notificationSignature } from "../../lib/midtrans";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

interface Notification {
    order_id?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
    transaction_status?: string;
    fraud_status?: string;
    transaction_id?: string;
}

function signatureMatches(expected: string, received: string): boolean {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    const config = await getMidtransConfig();
    if (!config) return NextResponse.json({ error: "Midtrans is not configured" }, { status: 503 });

    const body = (await readJsonBody(request)) as Notification;
    if (body instanceof NextResponse) return body;
    const orderId = body.order_id ?? "";
    const statusCode = body.status_code ?? "";
    const grossAmount = body.gross_amount ?? "";
    const received = body.signature_key ?? "";

    if (!orderId || !received) return NextResponse.json({ error: "Incomplete notification" }, { status: 400 });

    const expected = notificationSignature(config.serverKey, { orderId, statusCode, grossAmount });
    if (!signatureMatches(expected, received)) {
        log.error("[midtrans-gateway] a notification arrived with a bad signature", { orderId });
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const reference = fromOrderId(orderId);
    const status = body.transaction_status ?? "";
    const paid = status === "settlement" || (status === "capture" && body.fraud_status === "accept");

    if (paid) {
        const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind: "order",
            reference,
            provider: "midtrans",
            providerRef: body.transaction_id ?? orderId,
            amount: Number(grossAmount) || 0,
            currency: "IDR",
        });
        if (!outcome.handled) {
            log.error("[midtrans-gateway] nothing settled a paid transaction", { reference, orderId });
            // Midtrans repeats a notification it did not get a 200 for.
            return NextResponse.json({ error: "unhandled" }, { status: 500 });
        }
        return NextResponse.json({ received: true });
    }

    if (status === "refund" || status === "partial_refund") {
        const outcome = await applyFiltersAsync("payment.refunded", UNHANDLED, {
            provider: "midtrans",
            providerRef: body.transaction_id ?? orderId,
            amount: Number(grossAmount) || null,
        });
        if (!outcome.handled) log.warn("[midtrans-gateway] nothing recorded a refund", { orderId });
        return NextResponse.json({ received: true });
    }

    if (status === "expire" || status === "cancel" || status === "deny") {
        const outcome = await applyFiltersAsync("payment.voided", UNHANDLED, {
            kind: "order",
            reference,
            provider: "midtrans",
        });
        if (!outcome.handled) log.warn("[midtrans-gateway] nothing cancelled an unpaid transaction", { reference });
    }

    return NextResponse.json({ received: true });
}
