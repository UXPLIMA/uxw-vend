/**
 * Talking to NOWPayments.
 *
 * The invoice is priced in the store's currency and the buyer picks a coin on
 * the NOWPayments page, so this module never handles a rate. The one subtlety
 * is the IPN signature: it is an HMAC over the JSON body with its keys sorted,
 * not over the bytes that arrived, so the body has to be rebuilt before it can
 * be checked.
 */
import crypto from "crypto";
import { prisma } from "@/core/sdk/server";

export const NOWPAYMENTS_API = "https://api.nowpayments.io/v1";

export interface NowPaymentsConfig {
    apiKey: string;
    ipnSecret: string | null;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["nowpayments_api_key", "nowpayments_ipn_secret"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getNowPaymentsConfig(): Promise<NowPaymentsConfig | null> {
    const map = await readSettings();
    const apiKey = map.nowpayments_api_key ?? process.env.NOWPAYMENTS_API_KEY ?? null;
    if (!apiKey) return null;
    return { apiKey, ipnSecret: map.nowpayments_ipn_secret ?? process.env.NOWPAYMENTS_IPN_SECRET ?? null };
}

export async function isNowPaymentsConfigured(): Promise<boolean> {
    return (await getNowPaymentsConfig()) !== null;
}

/**
 * The signed form of an IPN body: every key sorted, at every level.
 *
 * NOWPayments signs the object, not the bytes, so re-serialising is the only
 * way to reproduce what it signed.
 */
export function sortedJson(value: unknown): string {
    return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value && typeof value === "object") {
        const source = value as Record<string, unknown>;
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(source).sort()) sorted[key] = sortValue(source[key]);
        return sorted;
    }
    return value;
}

/** What the `x-nowpayments-sig` header should read for this body. */
export function ipnSignature(secret: string, body: unknown): string {
    return crypto.createHmac("sha512", secret).update(sortedJson(body)).digest("hex");
}

/** The fiat currencies NOWPayments will price an invoice in. */
export const NOWPAYMENTS_CURRENCIES = new Set([
    "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK",
    "JPY", "SGD", "HKD", "NZD", "INR", "BRL", "MXN", "TRY", "ZAR", "AED", "RUB", "UAH", "IDR",
]);
