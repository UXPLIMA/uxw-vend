import Stripe from "stripe";
import { passOnFeeFrom } from "./fee";
import { prisma, readSettingStrings } from "@/core/sdk/server";

// Stripe client + enabled flag. Credentials are resolved from the
// `stripe_secret_key` / `stripe_public_key` Settings rows first (the
// admin UI writes there) and fall back to process.env.STRIPE_* for
// installs that configure via env. The first non-empty value wins.
//
// We cache the resolved credentials for the request lifetime - Settings
// reads are cheap but called from hot paths, and stripe.com latency
// dominates any local cache miss anyway.

let cached: { stripe: Stripe; secret: string } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

async function readCreds(): Promise<{ secret: string | null; publishable: string | null; webhookSecret: string | null }> {
    // Through the SDK rather than off the row. The secret key and the webhook
    // secret are encrypted at rest, so a direct read returns ciphertext and
    // Stripe rejects it as if the operator had mistyped the key.
    const map = await readSettingStrings([
        "stripe_secret_key",
        "stripe_public_key",
        "stripe_webhook_secret",
    ]);
    return {
        secret:        map.stripe_secret_key      ?? process.env.STRIPE_SECRET_KEY      ?? null,
        publishable:   map.stripe_public_key      ?? process.env.STRIPE_PUBLIC_KEY      ?? null,
        webhookSecret: map.stripe_webhook_secret  ?? process.env.STRIPE_WEBHOOK_SECRET  ?? null,
    };
}

async function resolveStripe(): Promise<Stripe | null> {
    const now = Date.now();
    if (cached && now - cachedAt < CACHE_TTL_MS) return cached.stripe;
    const { secret } = await readCreds();
    if (!secret) {
        cached = null;
        return null;
    }
    if (cached && cached.secret === secret) {
        cachedAt = now;
        return cached.stripe;
    }
    // Pinned deliberately, and NOT bumped when the SDK is. `stripe` narrows
    // `apiVersion` to whatever version that SDK release was generated against
    // (22.6.0 wants 2026-08-26.dahlia), so a routine dependency update would
    // otherwise silently change which Stripe API this store talks to - new
    // webhook payload shapes and checkout behaviour arriving as a side effect
    // of `npm update`, on the payments path, untested.
    //
    // Moving to a newer API version is its own change: read Stripe's upgrade
    // notes, replay the checkout and webhook flows, then update this literal
    // and drop the cast.
    const stripe = new Stripe(secret, {
        apiVersion: "2026-04-22.dahlia" as Stripe.StripeConfig["apiVersion"],
    });
    cached = { stripe, secret };
    cachedAt = now;
    return stripe;
}

/**
 * Returns the Stripe client, or throws if Stripe isn't configured.
 * Synchronous callers should be migrated to the async getter.
 */
export async function getStripe(): Promise<Stripe> {
    const s = await resolveStripe();
    if (!s) throw new Error("Stripe is not configured. Set stripe_secret_key in admin settings or STRIPE_SECRET_KEY in env.");
    return s;
}

export async function getStripeWebhookSecret(): Promise<string | null> {
    const { webhookSecret } = await readCreds();
    return webhookSecret;
}

/**
 * True when Stripe has at least a secret key configured.
 * The runtime gateway requires a secret key to do anything useful;
 * the public key matters only for client-side Elements, which this module
 * does not use - it redirects to Stripe Checkout instead. That is why there
 * is no reader for the publishable key here: the one that existed was called
 * by nothing, and a getter for a credential nobody needs is an invitation to
 * start needing it.
 */
export async function getStripeEnabled(): Promise<boolean> {
    const { secret } = await readCreds();
    return !!secret;
}

// Backwards-compat proxy for code that imported `stripe` directly.
// Will throw on first property access if not configured.
export const stripe = new Proxy({} as Stripe, {
    get(_, prop) {
        if (!cached) {
            throw new Error("stripe proxy used before getStripe()/getStripeEnabled() resolved; call those first or refactor caller.");
        }
        return (cached.stripe as unknown as Record<string | symbol, unknown>)[prop];
    },
});

/**
 * The fee this gateway offers to pass on to the buyer, or nothing.
 *
 * Read here rather than cached with the credentials: it is asked once per
 * checkout, not per API call, and an operator changing the rate should see it
 * on the next order rather than in half a minute.
 */
export async function getPassOnFee(): Promise<{ percent: number; fixed: number } | undefined> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["stripe_fee_pass", "stripe_fee_percent", "stripe_fee_fixed"] } },
    });
    const map: Record<string, unknown> = {};
    for (const row of rows) map[row.key] = row.value;
    return passOnFeeFrom({
        pass: map.stripe_fee_pass === true || map.stripe_fee_pass === "true",
        percent: Number(map.stripe_fee_percent),
        fixed: Number(map.stripe_fee_fixed),
    });
}
