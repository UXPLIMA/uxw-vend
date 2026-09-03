/**
 * Mollie's webhook.
 *
 * @provider-callback: the request body is a payment id and nothing else. The
 * status, the amount and the order it belongs to are all read back from Mollie
 * with this site's API key, so a forged post can at most make the server look
 * up a payment that is not paid.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyFiltersAsync } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { getMollieConfig, mollieGet } from "../../lib/mollie";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

export async function POST(request: NextRequest) {
    const config = await getMollieConfig();
    if (!config) return NextResponse.json({ error: "Mollie is not configured" }, { status: 503 });

    const form = await request.formData();
    const id = form.get("id");
    if (typeof id !== "string" || !id.startsWith("tr_")) {
        return NextResponse.json({ error: "No payment id" }, { status: 400 });
    }

    try {
        const payment = await mollieGet(config, `/payments/${encodeURIComponent(id)}`);
        const reference = payment.metadata?.reference;
        if (!reference) return NextResponse.json({ received: true });

        const kind: PaymentKind = payment.metadata?.kind === "credits" ? "credits" : "order";
        const amount = Number(payment.amount?.value ?? 0);
        const currency = payment.amount?.currency ?? "EUR";
        const refunded = Number(payment.amountRefunded?.value ?? 0);

        if (refunded > 0) {
            const outcome = await applyFiltersAsync("payment.refunded", UNHANDLED, {
                provider: "mollie",
                providerRef: id,
                amount: refunded,
            });
            if (!outcome.handled) log.warn("[mollie-gateway] nothing recorded a refund", { id });
            return NextResponse.json({ received: true });
        }

        if (payment.status === "paid") {
            const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
                kind,
                reference,
                provider: "mollie",
                providerRef: id,
                amount,
                currency,
                metadata: payment.metadata ?? {},
            });
            if (!outcome.handled) {
                log.error("[mollie-gateway] nothing settled a paid payment", { reference, id });
                // Mollie retries a webhook that did not answer 200.
                return NextResponse.json({ error: "unhandled" }, { status: 500 });
            }
            return NextResponse.json({ received: true });
        }

        if (payment.status === "expired" || payment.status === "canceled" || payment.status === "failed") {
            const outcome = await applyFiltersAsync("payment.voided", UNHANDLED, {
                kind,
                reference,
                provider: "mollie",
            });
            if (!outcome.handled) log.warn("[mollie-gateway] nothing cancelled an unpaid payment", { reference });
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        log.error("[mollie-gateway] could not read a payment back", {
            id,
            error: error instanceof Error ? error.message : String(error),
        });
        // Mollie should try again: this is our failure, not the buyer's.
        return NextResponse.json({ error: "lookup failed" }, { status: 500 });
    }
}
