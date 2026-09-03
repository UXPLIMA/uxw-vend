/**
 * paysafecard's notification, and the capture that has to follow it.
 *
 * @provider-callback: the request carries a payment id and nothing else. The
 * payment is read back from paysafecard with this site's API key, and only a
 * capture that paysafecard itself reports as SUCCESS settles an order.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyFiltersAsync } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { callPaysafecard, getPaysafecardConfig } from "../../lib/paysafecard";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

async function settle(paymentId: string): Promise<NextResponse> {
    const config = await getPaysafecardConfig();
    if (!config) return NextResponse.json({ error: "paysafecard is not configured" }, { status: 503 });

    try {
        const payment = await callPaysafecard(config, `/payments/${encodeURIComponent(paymentId)}`);
        const reference = payment.correlation_id;
        if (!reference) return NextResponse.json({ received: true });

        if (payment.status === "CANCELLED_CUSTOMER" || payment.status === "EXPIRED") {
            const voided = await applyFiltersAsync("payment.voided", UNHANDLED, {
                kind: "order",
                reference,
                provider: "paysafecard",
            });
            if (!voided.handled) log.warn("[paysafecard-gateway] nothing cancelled an abandoned payment", { reference });
            return NextResponse.json({ received: true });
        }

        // Authorised money that is never captured expires back to the buyer.
        const captured =
            payment.status === "SUCCESS"
                ? payment
                : payment.status === "AUTHORIZED"
                  ? await callPaysafecard(config, `/payments/${encodeURIComponent(paymentId)}/capture`, {
                        method: "POST",
                        body: {},
                    })
                  : null;

        if (!captured || captured.status !== "SUCCESS") return NextResponse.json({ received: true });

        const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind: "order",
            reference,
            provider: "paysafecard",
            providerRef: paymentId,
            amount: Number(captured.amount ?? payment.amount ?? 0),
            currency: captured.currency ?? payment.currency ?? "EUR",
        });

        if (!outcome.handled) {
            log.error("[paysafecard-gateway] nothing settled a captured payment", { reference, paymentId });
            return NextResponse.json({ error: "unhandled" }, { status: 500 });
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        log.error("[paysafecard-gateway] could not finish a payment", {
            paymentId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "lookup failed" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const paymentId = request.nextUrl.searchParams.get("payment_id");
    if (!paymentId) return NextResponse.json({ error: "No payment id" }, { status: 400 });
    return settle(paymentId);
}

/** paysafecard calls the notification URL with GET in some configurations. */
export async function GET(request: NextRequest) {
    const paymentId = request.nextUrl.searchParams.get("payment_id");
    if (!paymentId) return NextResponse.json({ error: "No payment id" }, { status: 400 });
    return settle(paymentId);
}
