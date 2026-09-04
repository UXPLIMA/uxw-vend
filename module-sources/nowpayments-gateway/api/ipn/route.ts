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

interface IpnBody {
    payment_id?: string | number;
    payment_status?: string;
    order_id?: string;
    price_amount?: number | string;
    price_currency?: string;
}

export async function POST(request: NextRequest) {
    const config = await getNowPaymentsConfig();
    if (!config?.ipnSecret) {
        return NextResponse.json({ error: "NOWPayments IPN is not configured" }, { status: 503 });
    }

    const signature = request.headers.get("x-nowpayments-sig");
    const body = (await readJsonBody(request)) as IpnBody;
    if (body instanceof NextResponse) return body;

    if (!signature || !signatureMatches(ipnSignature(config.ipnSecret, body), signature)) {
        log.error("[nowpayments-gateway] an IPN arrived with a bad signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const reference = body.order_id;
    if (!reference) return NextResponse.json({ received: true });

    const status = (body.payment_status ?? "").toLowerCase();
    const providerRef = String(body.payment_id ?? reference);

    if (status === "finished" || status === "confirmed") {
        const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind: "order",
            reference,
            provider: "nowpayments",
            providerRef,
            amount: Number(body.price_amount ?? 0),
            currency: (body.price_currency ?? "usd").toUpperCase(),
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
            amount: Number(body.price_amount ?? 0),
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
