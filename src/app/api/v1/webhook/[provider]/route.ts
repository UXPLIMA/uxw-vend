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
 * Max age of a webhook delivery we'll accept. Without this, a captured
 * valid signature can be replayed forever — the HMAC alone only proves
 * the sender knew the secret, not that the event is fresh. Tunable via
 * WEBHOOK_REPLAY_WINDOW_MS; default 5 minutes matches Stripe / GitHub.
 */
const REPLAY_WINDOW_MS = (() => {
    const raw = Number(process.env.WEBHOOK_REPLAY_WINDOW_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : 5 * 60 * 1000;
})();

function parseTimestampHeader(value: string | null): number | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Accept Unix seconds, Unix ms, or ISO-8601. Numeric heuristics first.
    if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        // Anything below year-2000 ms obviously came in as seconds.
        return trimmed.length >= 13 ? n : n * 1000;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
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

    const hasHmacConfig = Boolean(entry.signatureHeader && entry.secretEnv);
    const handlerVerifies = entry.verifiesInHandler === true;

    // Fail-closed: every receiver must either use the generic HMAC path or
    // explicitly take responsibility for verifying signatures in its handler.
    // A manifest that sets neither would otherwise ship as an unauthenticated
    // public endpoint.
    if (!hasHmacConfig && !handlerVerifies) {
        console.error(
            `[webhook] ${provider}: refusing dispatch — manifest provides neither signatureHeader+secretEnv nor verifiesInHandler`,
        );
        return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    if (hasHmacConfig) {
        const secret = process.env[entry.secretEnv!];
        if (!secret) {
            console.error(`[webhook] ${provider}: ${entry.secretEnv} not set`);
            return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
        }
        const sig = request.headers.get(entry.signatureHeader!);
        if (!sig) {
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }
        // Optional timestamp freshness check — when the manifest advertises a
        // timestampHeader, refuse anything older than REPLAY_WINDOW_MS so a
        // captured valid signature can't be replayed indefinitely.
        if (entry.timestampHeader) {
            const ts = parseTimestampHeader(request.headers.get(entry.timestampHeader));
            if (ts === null) {
                return NextResponse.json({ error: "Missing or invalid timestamp" }, { status: 401 });
            }
            const skew = Math.abs(Date.now() - ts);
            if (skew > REPLAY_WINDOW_MS) {
                return NextResponse.json({ error: "Timestamp outside allowed window" }, { status: 401 });
            }
        }
        const rawBody = await request.text();
        if (!verifyHmac(rawBody, sig, secret)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
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

    // verifiesInHandler === true: the module's handler is responsible for
    // its own signature check (e.g. PayPal verify-webhook-signature, Stripe
    // SDK). We pass the original Request through untouched.
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
