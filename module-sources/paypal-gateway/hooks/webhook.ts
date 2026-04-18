import { prisma } from "@/core/lib/db";

/**
 * ## Production setup
 *
 * To enable real PayPal webhook signature verification in production,
 * set the following environment variables on the server:
 *
 *   PAYPAL_CLIENT_ID       — REST API app Client ID from the PayPal developer dashboard
 *   PAYPAL_CLIENT_SECRET   — REST API app Client Secret (pair with the Client ID)
 *   PAYPAL_WEBHOOK_ID      — ID of the webhook you registered in the PayPal dashboard
 *   PAYPAL_ENVIRONMENT     — "live" for production, anything else (or unset) → sandbox
 *
 * How to register the webhook:
 *   1. In the PayPal developer dashboard, open your REST API app.
 *   2. Under "Webhooks", add: https://<your-domain>/api/v1/webhook/paypal
 *   3. Select the event types you want to receive (e.g. PAYMENT.CAPTURE.COMPLETED,
 *      PAYMENT.CAPTURE.DENIED, BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED).
 *   4. Copy the generated Webhook ID into PAYPAL_WEBHOOK_ID.
 *
 * Official docs:
 *   https://developer.paypal.com/api/rest/webhooks/
 *   https://developer.paypal.com/api/rest/webhooks/rest/#link-verifywebhooksignature
 *
 * Runtime flow once configured:
 *   inbound POST → dispatcher → this handler →
 *     1. POST /v1/oauth2/token (Basic auth, grant_type=client_credentials) → access_token
 *     2. POST /v1/notifications/verify-webhook-signature (Bearer access_token)
 *        with the 5 paypal-* headers + webhook_id + webhook_event body
 *     3. On verification_status === "SUCCESS", log the event and return 200
 *
 * Without these env vars the handler runs in "dev-accept" mode: it logs a
 * warning and accepts every webhook unverified. This makes local dev without
 * a real PayPal account possible — it is NEVER safe for production.
 *
 * PayPal inbound webhook handler.
 *
 * Performs REAL PayPal webhook signature verification using PayPal's
 * `verify-webhook-signature` REST endpoint:
 *
 *   1. Grab the five transmission headers PayPal sends:
 *        paypal-transmission-id
 *        paypal-transmission-time
 *        paypal-cert-url
 *        paypal-auth-algo
 *        paypal-transmission-sig
 *   2. Obtain an OAuth2 bearer token via POST /v1/oauth2/token using
 *      Basic auth of PAYPAL_CLIENT_ID:PAYPAL_CLIENT_SECRET.
 *   3. POST those headers + PAYPAL_WEBHOOK_ID + the parsed webhook event
 *      body to /v1/notifications/verify-webhook-signature.
 *   4. Only if `verification_status === "SUCCESS"` continue with event
 *      processing; otherwise return 401.
 *
 * Environment variables:
 *   PAYPAL_CLIENT_ID      (required for real verification)
 *   PAYPAL_CLIENT_SECRET  (required for real verification)
 *   PAYPAL_WEBHOOK_ID     (required for real verification)
 *   PAYPAL_ENVIRONMENT    "live" | "sandbox" (default: sandbox)
 *
 * Dev fallback: when PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing
 * we log a warning and accept the webhook without verification so local
 * development without a real PayPal account still works. Production
 * deployments MUST set all three vars.
 *
 * Note: the core dispatcher no longer applies generic HMAC for this
 * provider — the paypal entry in module.json deliberately omits
 * `secretEnv`, so this handler is the sole line of defence.
 */

const PAYPAL_BASE =
    process.env.PAYPAL_ENVIRONMENT === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

interface PayPalEvent {
    id?: string;
    event_type?: string;
    resource?: unknown;
}

interface PayPalTokenResponse {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
}

interface PayPalVerifyResponse {
    verification_status?: "SUCCESS" | "FAILURE";
}

/**
 * Fetch an OAuth2 bearer token from PayPal. Returns null on any failure
 * so the caller can decide how to handle it (reject or fall through).
 */
async function getPayPalAccessToken(
    clientId: string,
    clientSecret: string
): Promise<string | null> {
    try {
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${basicAuth}`,
            },
            body: "grant_type=client_credentials",
        });
        if (!res.ok) {
            console.error(
                `[paypal-gateway] oauth token request failed: ${res.status} ${res.statusText}`
            );
            return null;
        }
        const json = (await res.json()) as PayPalTokenResponse;
        return json.access_token ?? null;
    } catch (err) {
        console.error("[paypal-gateway] oauth token request errored:", err);
        return null;
    }
}

/**
 * Call PayPal's verify-webhook-signature endpoint. Returns true on
 * verification SUCCESS, false otherwise.
 */
async function verifyPayPalSignature(
    accessToken: string,
    webhookId: string,
    headers: Headers,
    webhookEvent: PayPalEvent
): Promise<boolean> {
    const transmissionId = headers.get("paypal-transmission-id");
    const transmissionTime = headers.get("paypal-transmission-time");
    const certUrl = headers.get("paypal-cert-url");
    const authAlgo = headers.get("paypal-auth-algo");
    const transmissionSig = headers.get("paypal-transmission-sig");

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
        console.warn("[paypal-gateway] webhook missing one or more PayPal transmission headers");
        return false;
    }

    try {
        const res = await fetch(
            `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    transmission_id: transmissionId,
                    transmission_time: transmissionTime,
                    cert_url: certUrl,
                    auth_algo: authAlgo,
                    transmission_sig: transmissionSig,
                    webhook_id: webhookId,
                    webhook_event: webhookEvent,
                }),
            }
        );
        if (!res.ok) {
            console.error(
                `[paypal-gateway] verify-webhook-signature call failed: ${res.status} ${res.statusText}`
            );
            return false;
        }
        const json = (await res.json()) as PayPalVerifyResponse;
        return json.verification_status === "SUCCESS";
    } catch (err) {
        console.error("[paypal-gateway] verify-webhook-signature errored:", err);
        return false;
    }
}

export default async function handleWebhook(
    request: Request
): Promise<{ status: number; body?: unknown }> {
    // Read the raw body once — we need it parsed for both verification
    // (webhook_event field) and downstream event handling.
    let rawBody: string;
    try {
        rawBody = await request.text();
    } catch {
        return { status: 400, body: { error: "Unable to read body" } };
    }

    let event: PayPalEvent;
    try {
        event = JSON.parse(rawBody) as PayPalEvent;
    } catch {
        return { status: 400, body: { error: "Invalid JSON" } };
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    // Verification is MANDATORY in production. Without all three credentials
    // an attacker who knows the webhook URL can forge PAYMENT.CAPTURE.COMPLETED
    // events and credit orders that were never paid for. Dev-mode opt-out
    // only works when NODE_ENV !== production AND PAYPAL_ALLOW_UNVERIFIED=1
    // is set explicitly — it is never implicit.
    const hasCredentials = Boolean(clientId && clientSecret && webhookId);
    if (!hasCredentials) {
        const isProd = process.env.NODE_ENV === "production";
        const devOptIn = process.env.PAYPAL_ALLOW_UNVERIFIED === "1";
        if (isProd || !devOptIn) {
            console.error(
                "[paypal-gateway] refusing webhook: PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID must be set. Set PAYPAL_ALLOW_UNVERIFIED=1 in dev to bypass.",
            );
            return { status: 503, body: { error: "PayPal webhook verification not configured" } };
        }
        console.warn(
            "[paypal-gateway] DEV MODE — accepting webhook without signature verification. Never enable PAYPAL_ALLOW_UNVERIFIED in production.",
        );
    } else {
        const token = await getPayPalAccessToken(clientId!, clientSecret!);
        if (!token) {
            return { status: 401, body: { error: "Invalid signature" } };
        }
        const ok = await verifyPayPalSignature(token, webhookId!, request.headers, event);
        if (!ok) {
            return { status: 401, body: { error: "Invalid signature" } };
        }
    }

    const eventType =
        typeof event.event_type === "string" ? event.event_type : "paypal.unknown";

    try {
        await prisma.webhookLog.create({
            data: {
                event: eventType,
                url: request.url,
                status: 200,
                payload: event as object,
            },
        });
    } catch (err) {
        console.error("[paypal-gateway] failed to log webhook:", err);
    }

    // TODO: Dispatch PAYMENT.CAPTURE.COMPLETED, BILLING.SUBSCRIPTION.*
    // etc. into the store module to update orders/subscriptions.

    return { status: 200, body: { received: true, event: eventType } };
}
