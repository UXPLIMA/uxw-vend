/**
 * Talking to Razorpay.
 *
 * The payment is a Payment Link: Razorpay hosts the page, offers UPI, cards,
 * netbanking and wallets on it, and reports the result on a webhook. Amounts
 * are in the smallest unit everywhere - paise for rupees - so they are
 * converted in exactly two places, here and back again in the webhook.
 */
import { prisma } from "@/core/sdk/server";

export const RAZORPAY_API = "https://api.razorpay.com/v1";

export interface RazorpayConfig {
    keyId: string;
    keySecret: string;
    webhookSecret: string | null;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["razorpay_key_id", "razorpay_key_secret", "razorpay_webhook_secret"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
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
