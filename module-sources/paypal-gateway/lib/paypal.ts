/**
 * PayPal REST API v2 integration.
 *
 * Credentials are read from the `paypal_client_id`, `paypal_client_secret`,
 * `paypal_mode` Settings rows (admin UI source of truth) with
 * `process.env.PAYPAL_*` as fallback. The first non-empty value wins.
 *
 * Settings are cached for 30s inside the request lifecycle to avoid
 * hammering the Setting table on hot paths; PayPal call latency
 * dominates anyway.
 */

import { prisma } from "@/core/lib/db";

type PaypalCreds = { clientId: string | null; clientSecret: string | null; mode: "live" | "sandbox" };

let cached: PaypalCreds | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

async function readCreds(): Promise<PaypalCreds> {
    const now = Date.now();
    if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["paypal_client_id", "paypal_client_secret", "paypal_mode"] } },
    });
    const map: Record<string, string | null> = {};
    for (const r of rows) {
        const v = r.value;
        map[r.key] = typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    }
    const mode = (map.paypal_mode ?? process.env.PAYPAL_MODE ?? "sandbox") === "live" ? "live" : "sandbox";
    cached = {
        clientId:     map.paypal_client_id     ?? process.env.PAYPAL_CLIENT_ID     ?? null,
        clientSecret: map.paypal_client_secret ?? process.env.PAYPAL_CLIENT_SECRET ?? null,
        mode,
    };
    cachedAt = now;
    return cached;
}

async function paypalBase(): Promise<string> {
    const { mode } = await readCreds();
    return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function getPaypalEnabled(): Promise<boolean> {
    const { clientId, clientSecret } = await readCreds();
    return !!(clientId && clientSecret);
}

async function getAccessToken(): Promise<string> {
    const { clientId, clientSecret } = await readCreds();
    if (!clientId || !clientSecret) {
        throw new Error("PayPal is not configured. Set paypal_client_id/secret in admin settings or PAYPAL_CLIENT_ID/_SECRET in env.");
    }
    const base = await paypalBase();
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    const data = await res.json();
    return data.access_token;
}

export async function createPaypalOrder(params: {
    amount: number;
    currency?: string;
    orderId: string;
    returnUrl: string;
    cancelUrl: string;
}): Promise<{ id: string; approveUrl: string }> {
    const token = await getAccessToken();
    const base = await paypalBase();

    const res = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
                reference_id: params.orderId,
                amount: {
                    currency_code: params.currency || "USD",
                    value: params.amount.toFixed(2),
                },
            }],
            application_context: {
                return_url: params.returnUrl,
                cancel_url: params.cancelUrl,
                brand_name: process.env.NEXT_PUBLIC_APP_NAME || "uxwVend",
            },
        }),
    });

    const data = await res.json();
    const approveLink = data.links?.find((l: { rel: string }) => l.rel === "approve");

    return {
        id: data.id,
        approveUrl: approveLink?.href || "",
    };
}

export async function capturePaypalOrder(paypalOrderId: string): Promise<{
    status: string;
    payer: { email: string; name: string };
    amount: number;
}> {
    const token = await getAccessToken();
    const base = await paypalBase();

    const res = await fetch(`${base}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    const data = await res.json();
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

    return {
        status: data.status,
        payer: {
            email: data.payer?.email_address || "",
            name: `${data.payer?.name?.given_name || ""} ${data.payer?.name?.surname || ""}`.trim(),
        },
        amount: parseFloat(capture?.amount?.value || "0"),
    };
}
