import Stripe from "stripe";
import { prisma } from "@/core/lib/db";

// Stripe client + enabled flag. Credentials are resolved from the
// `stripe_secret_key` / `stripe_public_key` Settings rows first (the
// admin UI writes there) and fall back to process.env.STRIPE_* for
// installs that configure via env. The first non-empty value wins.
//
// We cache the resolved credentials for the request lifetime — Settings
// reads are cheap but called from hot paths, and stripe.com latency
// dominates any local cache miss anyway.

let cached: { stripe: Stripe; secret: string } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

async function readCreds(): Promise<{ secret: string | null; publishable: string | null; webhookSecret: string | null }> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["stripe_secret_key", "stripe_public_key", "stripe_webhook_secret"] } },
    });
    const map: Record<string, string | null> = {};
    for (const r of rows) {
        const v = r.value;
        map[r.key] = typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    }
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
    const stripe = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });
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

export async function getStripePublicKey(): Promise<string | null> {
    const { publishable } = await readCreds();
    return publishable;
}

/**
 * True when Stripe has at least a secret key configured.
 * The runtime gateway requires a secret key to do anything useful;
 * the public key matters only for client-side Elements which we
 * don't currently use (we redirect to Stripe Checkout instead).
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
