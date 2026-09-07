/**
 * What NOWPayments says about a payment.
 *
 * A coin payment walks through several statuses on its way to being final, and
 * only two of them mean the money is there. The rest are reported and ignored:
 * granting on "confirming" would hand out a product for a transaction that can
 * still be replaced.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { applyFiltersAsync } from "@/core/sdk";
import { log, readJsonBody } from "@/core/sdk/server";
import { getNowPaymentsConfig, ipnSignature } from "../../lib/nowpayments";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

/** Constant-time compare, so a wrong signature leaks nothing by timing. */
function signatureMatches(expected: string, received: string): boolean {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * The fields this route reads, and only those.
 *
 * The body used to be cast to an interface, which the compiler believes and
 * the runtime does not: a `price_amount` the provider sent as text went
 * through `Number()` as `NaN` and into the settlement as the amount.
 *
 * Everything is optional and coerced, so a payload that works today still
 * works. Unknown fields are dropped rather than refused, because a webhook
 * that rejects an unfamiliar field is a webhook that loses payments the week
 * the provider adds one.
 */
const IPN_BODY = z.object({
    payment_id: z.union([z.string(), z.number()]).optional(),
    payment_status: z.string().optional(),
    order_id: z.string().optional(),
    price_amount: z.coerce.number().finite().optional(),
    price_currency: z.string().optional(),
});

export async function POST(request: NextRequest) {
    const config = await getNowPaymentsConfig();
    if (!config?.ipnSecret) {
        return NextResponse.json({ error: "NOWPayments IPN is not configured" }, { status: 503 });
    }

    const signature = request.headers.get("x-nowpayments-sig");
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    // Signed over what arrived, before anything reshapes it.
    if (!signature || !signatureMatches(ipnSignature(config.ipnSecret, body), signature)) {
        log.error("[nowpayments-gateway] an IPN arrived with a bad signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const parsed = IPN_BODY.safeParse(body);
    if (!parsed.success) {
        log.error("[nowpayments-gateway] an IPN arrived in a shape this build cannot read", {
            issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.code}`).join(", "),
        });
        return NextResponse.json({ error: "Unreadable notification" }, { status: 400 });
    }
    const payload = parsed.data;

    const reference = payload.order_id;
    if (!reference) return NextResponse.json({ received: true });

    const status = (payload.payment_status ?? "").toLowerCase();
    const providerRef = String(payload.payment_id ?? reference);

    if (status === "finished" || status === "confirmed") {
        const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind: "order",
            reference,
            provider: "nowpayments",
            providerRef,
            amount: Number(payload.price_amount ?? 0),
            currency: (payload.price_currency ?? "usd").toUpperCase(),
        });
        if (!outcome.handled) {
            log.error("[nowpayments-gateway] nothing settled a finished payment", { reference, providerRef });
            return NextResponse.json({ error: "unhandled" }, { status: 500 });
        }
        return NextResponse.json({ received: true });
    }

    if (status === "refunded") {
        const outcome = await applyFiltersAsync("payment.refunded", UNHANDLED, {
            provider: "nowpayments",
            providerRef,
            amount: Number(payload.price_amount ?? 0),
        });
        if (!outcome.handled) log.warn("[nowpayments-gateway] nothing recorded a refund", { providerRef });
        return NextResponse.json({ received: true });
    }

    if (status === "failed" || status === "expired") {
        const outcome = await applyFiltersAsync("payment.voided", UNHANDLED, {
            kind: "order",
            reference,
            provider: "nowpayments",
        });
        if (!outcome.handled) log.warn("[nowpayments-gateway] nothing cancelled a failed payment", { reference });
        return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
}
