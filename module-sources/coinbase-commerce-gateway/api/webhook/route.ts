/**
 * What Coinbase Commerce says about a charge.
 *
 * Only `charge:confirmed` settles anything. A coin payment is reported as
 * pending the moment it is broadcast, and a store that granted on "pending"
 * would be handing out products for transactions that can still be dropped.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { applyFiltersAsync } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { getCoinbaseConfig } from "../../lib/coinbase";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

interface CoinbaseEvent {
    event?: {
        type?: string;
        data?: {
            id?: string;
            code?: string;
            metadata?: Record<string, string>;
            pricing?: { local?: { amount?: string; currency?: string } };
        };
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
    const config = await getCoinbaseConfig();
    if (!config?.webhookSecret) {
        return NextResponse.json({ error: "Coinbase webhooks are not configured" }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get("x-cc-webhook-signature");
    if (!signature || !signatureMatches(config.webhookSecret, body, signature)) {
        log.error("[coinbase-commerce-gateway] a webhook arrived with a bad signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(body) as CoinbaseEvent;
    const charge = payload.event?.data;
    const reference = charge?.metadata?.reference;
    if (!reference) return NextResponse.json({ received: true });

    const kind: PaymentKind = charge?.metadata?.kind === "credits" ? "credits" : "order";
    const providerRef = charge?.code ?? charge?.id ?? reference;

    if (payload.event?.type === "charge:confirmed") {
        const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind,
            reference,
            provider: "coinbase-commerce",
            providerRef,
            amount: Number(charge?.pricing?.local?.amount ?? 0),
            currency: charge?.pricing?.local?.currency ?? "USD",
            metadata: charge?.metadata ?? {},
        });
        if (!outcome.handled) {
            log.error("[coinbase-commerce-gateway] nothing settled a confirmed charge", { reference, providerRef });
            // Coinbase retries a webhook it did not get a 2xx for, which is
            // the only thing standing between a paid order and a lost one.
            return NextResponse.json({ error: "unhandled" }, { status: 500 });
        }
        return NextResponse.json({ received: true });
    }

    if (payload.event?.type === "charge:failed") {
        const outcome = await applyFiltersAsync("payment.voided", UNHANDLED, {
            kind,
            reference,
            provider: "coinbase-commerce",
        });
        if (!outcome.handled) log.warn("[coinbase-commerce-gateway] nothing cancelled a failed charge", { reference });
        return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
}
