/**
 * PayPal REST API v2 Integration
 * Docs: https://developer.paypal.com/docs/api/orders/v2/
 */

const PAYPAL_BASE = process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export function getPaypalEnabled(): boolean {
    return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function getAccessToken(): Promise<string> {
    const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
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

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
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

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
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
