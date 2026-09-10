/**
 * Talking to Razorpay.
 *
 * The payment is a Payment Link: Razorpay hosts the page, offers UPI, cards,
 * netbanking and wallets on it, and reports the result on a webhook. Amounts
 * are in the smallest unit everywhere - paise for rupees - so they are
 * converted in exactly two places, here and back again in the webhook.
 */
import { readSettingStrings } from "@/core/sdk/server";

export const RAZORPAY_API = "https://api.razorpay.com/v1";

export interface RazorpayConfig {
    keyId: string;
    keySecret: string;
    webhookSecret: string | null;
}

async function readSettings(): Promise<Record<string, string | null>> {
    // Through the SDK rather than off the row. The credentials among these
    // keys are encrypted at rest, so a direct read returns ciphertext and
    // the provider rejects it as if the operator had mistyped the key.
    return readSettingStrings(["razorpay_key_id", "razorpay_key_secret", "razorpay_webhook_secret"]);
}

export async function getRazorpayConfig(): Promise<RazorpayConfig | null> {
    const map = await readSettings();
    const keyId = map.razorpay_key_id ?? process.env.RAZORPAY_KEY_ID ?? null;
    const keySecret = map.razorpay_key_secret ?? process.env.RAZORPAY_KEY_SECRET ?? null;
    if (!keyId || !keySecret) return null;
    return {
        keyId,
        keySecret,
        webhookSecret: map.razorpay_webhook_secret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? null,
    };
}

export async function isRazorpayConfigured(): Promise<boolean> {
    return (await getRazorpayConfig()) !== null;
}

export function razorpayAuth(config: RazorpayConfig): string {
    return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}

/**
 * Razorpay is an Indian processor; international currencies exist but are
 * enabled per account, so the list stays short and honest.
 */
export const RAZORPAY_CURRENCIES = new Set(["INR", "USD", "EUR", "GBP", "SGD", "AED"]);

export interface RazorpayPaymentLink {
    id?: string;
    short_url?: string;
    error?: { description?: string };
}
