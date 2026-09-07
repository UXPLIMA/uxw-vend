/**
 * What Midtrans says about a Snap transaction.
 *
 * A card payment can arrive as "capture" with a fraud status still pending
 * review; only an accepted capture, or a settlement, means the money is ours.
 * Anything else is recorded as unpaid rather than granted.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { applyFiltersAsync } from "@/core/sdk";
import { log, readJsonBody } from "@/core/sdk/server";
import { fromOrderId, getMidtransConfig, notificationSignature } from "../../lib/midtrans";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

/**
 * The fields this route reads, and only those.
 *
 * The body used to be cast to an interface, which the compiler believes and
 * the runtime does not. The amount was then read as `Number(x) || 0`, and the
 * `|| 0` swallowed anything that did not read as a number: a transaction
 * settled, for zero, and looked like a paid order.
 *
 * The three fields the signature is built from stay strings, because that is
 * what they are hashed as. Everything else is optional, so a payload that
 * works today still works, and unknown fields are dropped rather than
 * refused, because a webhook that rejects an unfamiliar field is a webhook
 * that loses payments the week the provider adds one.
 */
const NOTIFICATION = z.object({
    order_id: z.string(),
    status_code: z.string().optional(),
    gross_amount: z.coerce.number().finite().optional(),
    transaction_status: z.string().optional(),
    fraud_status: z.string().optional(),
    transaction_id: z.string().optional(),
});

function signatureMatches(expected: string, received: string): boolean {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    const config = await getMidtransConfig();
    if (!config) return NextResponse.json({ error: "Midtrans is not configured" }, { status: 503 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    // Hashed as they arrived, before anything reshapes them.
    const raw = (body ?? {}) as Record<string, unknown>;
    const asText = (value: unknown) => (typeof value === "string" ? value : "");
    const orderId = asText(raw.order_id);
    const statusCode = asText(raw.status_code);
    const grossAmount = asText(raw.gross_amount);
    const received = asText(raw.signature_key);

    if (!orderId || !received) return NextResponse.json({ error: "Incomplete notification" }, { status: 400 });

    const expected = notificationSignature(config.serverKey, { orderId, statusCode, grossAmount });
    if (!signatureMatches(expected, received)) {
        log.error("[midtrans-gateway] a notification arrived with a bad signature", { orderId });
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const parsed = NOTIFICATION.safeParse(body);
    if (!parsed.success) {
        log.error("[midtrans-gateway] a notification arrived in a shape this build cannot read", {
            orderId,
            issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.code}`).join(", "),
        });
        return NextResponse.json({ error: "Unreadable notification" }, { status: 400 });
    }
    const payload = parsed.data;

    const reference = fromOrderId(orderId);
    const status = payload.transaction_status ?? "";
    const paid = status === "settlement" || (status === "capture" && payload.fraud_status === "accept");

    if (paid) {
        const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind: "order",
            reference,
            provider: "midtrans",
            providerRef: payload.transaction_id ?? orderId,
            amount: payload.gross_amount ?? 0,
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
            providerRef: payload.transaction_id ?? orderId,
            amount: payload.gross_amount ?? null,
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
