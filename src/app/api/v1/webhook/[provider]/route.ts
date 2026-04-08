import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ModuleWebhookReceivers } from "@/core/generated/module-webhooks";
import { getModuleStates } from "@/core/lib/module-cache";

type RouteParams = { params: Promise<{ provider: string }> };

/**
 * Verify HMAC-SHA256 signature on a raw request body using a shared secret.
 * Generic enough for Stripe-style webhooks; provider-specific schemes can
 * still verify their own way inside their handler.
 */
function verifyHmac(payload: string, signature: string, secret: string): boolean {
    try {
        const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
        // Constant-time comparison
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

/**
 * Inbound webhook dispatcher.
 * POST /api/v1/webhook/<provider>
 *
 * Looks up the registered handler for that provider, optionally verifies
 * the signature header against an env-stored secret, then calls the
 * handler with the original Request object.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { provider } = await params;

    const entry = ModuleWebhookReceivers.find((r) => r.provider === provider);
    if (!entry) {
        return NextResponse.json({ error: "Unknown webhook provider" }, { status: 404 });
    }

    // Skip if the contributing module is disabled
    const moduleStates = await getModuleStates();
    if (moduleStates[entry.module] === false) {
        return NextResponse.json({ error: "Module disabled" }, { status: 404 });
    }

    // Optional signature verification (works for simple HMAC; complex providers
    // like Stripe verify inside their handler with the SDK)
    if (entry.signatureHeader && entry.secretEnv) {
        const secret = process.env[entry.secretEnv];
        if (!secret) {
            console.error(`[webhook] ${provider}: ${entry.secretEnv} not set`);
            return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
        }
        const sig = request.headers.get(entry.signatureHeader);
        if (!sig) {
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }
        const rawBody = await request.text();
        if (!verifyHmac(rawBody, sig, secret)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
        // Re-create the request with the consumed body so the handler can re-read it
        const newRequest = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: rawBody,
        });
        try {
            const mod = await entry.loader();
            const result = await mod.default(newRequest);
            return NextResponse.json(result.body || { ok: true }, { status: result.status || 200 });
        } catch (err) {
            console.error(`[webhook] ${provider} handler failed:`, err);
            return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
        }
    }

    // No verification — pass-through
    try {
        const mod = await entry.loader();
        const result = await mod.default(request);
        return NextResponse.json(result.body || { ok: true }, { status: result.status || 200 });
    } catch (err) {
        console.error(`[webhook] ${provider} handler failed:`, err);
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }
}

// Some providers GET to verify endpoint existence
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { provider } = await params;
    const entry = ModuleWebhookReceivers.find((r) => r.provider === provider);
    if (!entry) {
        return NextResponse.json({ error: "Unknown webhook provider" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, provider });
}
