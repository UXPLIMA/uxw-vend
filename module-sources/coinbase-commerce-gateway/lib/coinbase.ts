/**
 * Talking to Coinbase Commerce.
 *
 * The buyer pays in a coin; the charge is priced in the store's own currency
 * and Coinbase handles the conversion, so nothing here has to know an exchange
 * rate. What it does have to know is that the webhook is the only trustworthy
 * report of a payment: the buyer is redirected back the moment they send the
 * transaction, long before it confirms.
 */
import { prisma } from "@/core/sdk/server";

export const COINBASE_API = "https://api.commerce.coinbase.com";
export const COINBASE_API_VERSION = "2018-03-22";

export interface CoinbaseConfig {
    apiKey: string;
    webhookSecret: string | null;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["coinbase_api_key", "coinbase_webhook_secret"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getCoinbaseConfig(): Promise<CoinbaseConfig | null> {
    const map = await readSettings();
    const apiKey = map.coinbase_api_key ?? process.env.COINBASE_COMMERCE_API_KEY ?? null;
    if (!apiKey) return null;
    return {
        apiKey,
        webhookSecret: map.coinbase_webhook_secret ?? process.env.COINBASE_COMMERCE_WEBHOOK_SECRET ?? null,
    };
}

export async function isCoinbaseConfigured(): Promise<boolean> {
    return (await getCoinbaseConfig()) !== null;
}

/**
 * The fiat currencies Coinbase Commerce will price a charge in. A currency it
 * does not know would be refused after the buyer picked the button, so the
 * button is not drawn.
 */
export const COINBASE_CURRENCIES = new Set([
    "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK",
    "JPY", "SGD", "HKD", "NZD", "INR", "BRL", "MXN", "TRY", "ZAR", "AED", "RUB",
]);

export interface CoinbaseCharge {
    data?: {
        id?: string;
        code?: string;
        hosted_url?: string;
    };
    error?: { message?: string };
}
