/**
 * Talking to CoinPayments.
 *
 * This module uses the hosted checkout rather than the merchant API: the
 * payment is a link, and the only credential that has to exist on the server
 * is the IPN secret used to verify what comes back. That is a smaller secret
 * to hold than an API key pair, and it is the one that actually protects the
 * store - a forged IPN is the only way a hosted checkout can be abused.
 */
import { prisma } from "@/core/sdk/server";

export const COINPAYMENTS_CHECKOUT = "https://www.coinpayments.net/index.php";

export interface CoinPaymentsConfig {
    merchantId: string;
    ipnSecret: string | null;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["coinpayments_merchant_id", "coinpayments_ipn_secret"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getCoinPaymentsConfig(): Promise<CoinPaymentsConfig | null> {
    const map = await readSettings();
    const merchantId = map.coinpayments_merchant_id ?? process.env.COINPAYMENTS_MERCHANT_ID ?? null;
    if (!merchantId) return null;
    return { merchantId, ipnSecret: map.coinpayments_ipn_secret ?? process.env.COINPAYMENTS_IPN_SECRET ?? null };
}

/**
 * Configured means both halves. Without the IPN secret nothing could ever be
 * settled, so offering the button would take money and grant nothing.
 */
export async function isCoinPaymentsConfigured(): Promise<boolean> {
    const config = await getCoinPaymentsConfig();
    return config !== null && config.ipnSecret !== null;
}

/** The fiat currencies CoinPayments prices a hosted checkout in. */
export const COINPAYMENTS_CURRENCIES = new Set([
    "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK",
    "JPY", "SGD", "HKD", "NZD", "INR", "BRL", "MXN", "TRY", "ZAR", "RUB",
]);

/**
 * CoinPayments reports progress as a number: negative is dead, 100 (or 2, for
 * a PayPal-style "queued for payout") means the coins are ours.
 */
export function statusOf(status: number): "complete" | "failed" | "pending" {
    if (status >= 100 || status === 2) return "complete";
    if (status < 0) return "failed";
    return "pending";
}
