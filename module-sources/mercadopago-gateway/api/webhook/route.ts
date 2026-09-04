/**
 * Mercado Pago's payment notification.
 *
 * @provider-callback: the notification names a payment id and nothing more.
 * The status, amount and order are read back from Mercado Pago with this
 * site's access token, so a forged notification settles nothing. When the
 * account has webhook signing switched on, the x-signature header is checked
 * as well, before the lookup.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { applyFiltersAsync } from "@/core/sdk";
import { log, readJsonBody } from "@/core/sdk/server";
import {
    getMercadoPagoConfig,
    mercadoPagoGet,
    parseSignatureHeader,
    webhookManifestSignature,
} from "../../lib/mercadopago";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

/**
 * What Mercado Pago sends. The body used to be cast to this shape rather
 * than checked against it, so a notification carrying an object where an id
 * was expected reached `String(...)` and became "[object Object]" - a payment
 * id that matches nothing, looked up against the provider on every retry.
 * A body that does not fit is acknowledged and dropped rather than answered
 * with an error, because a non-2xx here only buys another delivery attempt.
 */
const notificationSchema = z.object({
    type: z.string().max(64).optional(),
    topic: z.string().max(64).optional(),
    data: z.object({ id: z.union([z.string().max(128), z.number()]).optional() }).optional(),
});

function signatureMatches(expected: string, received: string): boolean {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    const config = await getMercadoPagoConfig();
    if (!config) return NextResponse.json({ error: "Mercado Pago is not configured" }, { status: 503 });

    const raw = await readJsonBody(request, { fallback: {} });
    if (raw instanceof NextResponse) return raw;
    const notification = notificationSchema.safeParse(raw);
    const body = notification.success ? notification.data : {};
    const kind = body.type ?? body.topic ?? request.nextUrl.searchParams.get("type") ?? "";
    const paymentId = String(body.data?.id ?? request.nextUrl.searchParams.get("data.id") ?? "");

    if (kind !== "payment" || !paymentId) return NextResponse.json({ received: true });

    if (config.webhookSecret) {
        const header = request.headers.get("x-signature");
        const parsed = header ? parseSignatureHeader(header) : null;
        const requestId = request.headers.get("x-request-id") ?? "";
        const expected = parsed
            ? webhookManifestSignature(config.webhookSecret, {
                  dataId: paymentId,
                  requestId,
                  timestamp: parsed.ts,
              })
            : null;

        if (!parsed || !expected || !signatureMatches(expected, parsed.v1)) {
            log.error("[mercadopago-gateway] a notification arrived with a bad signature", { paymentId });
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }
    }

    try {
        const payment = await mercadoPagoGet(config, `/v1/payments/${encodeURIComponent(paymentId)}`);
        const reference = payment.external_reference;
        if (!reference) return NextResponse.json({ received: true });

        const paymentKind: PaymentKind = payment.metadata?.kind === "credits" ? "credits" : "order";

        if (payment.status === "approved") {
            const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
                kind: paymentKind,
                reference,
                provider: "mercadopago",
                providerRef: String(payment.id ?? paymentId),
                amount: Number(payment.transaction_amount ?? 0),
                currency: payment.currency_id ?? "ARS",
                metadata: payment.metadata ?? {},
            });
            if (!outcome.handled) {
                log.error("[mercadopago-gateway] nothing settled an approved payment", { reference, paymentId });
                return NextResponse.json({ error: "unhandled" }, { status: 500 });
            }
            return NextResponse.json({ received: true });
        }

        if (payment.status === "refunded" || payment.status === "charged_back") {
            const outcome = await applyFiltersAsync("payment.refunded", UNHANDLED, {
                provider: "mercadopago",
                providerRef: String(payment.id ?? paymentId),
                amount: payment.transaction_amount ?? null,
            });
            if (!outcome.handled) log.warn("[mercadopago-gateway] nothing recorded a refund", { paymentId });
            return NextResponse.json({ received: true });
        }

        if (payment.status === "cancelled" || payment.status === "rejected") {
            const outcome = await applyFiltersAsync("payment.voided", UNHANDLED, {
                kind: paymentKind,
                reference,
                provider: "mercadopago",
            });
            if (!outcome.handled) log.warn("[mercadopago-gateway] nothing cancelled a rejected payment", { reference });
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        log.error("[mercadopago-gateway] could not read a payment back", {
            paymentId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "lookup failed" }, { status: 500 });
    }
}
