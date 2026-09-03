/**
 * Talking to Mollie.
 *
 * Mollie's webhook carries a payment id and nothing else - not the status, not
 * the amount. That is deliberate on their side: the only trustworthy source is
 * Mollie itself, so this module reads the payment back with its own API key
 * before it settles anything.
 */
import { prisma } from "@/core/sdk/server";

export const MOLLIE_API = "https://api.mollie.com/v2";

export interface MollieConfig {
    apiKey: string;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({ where: { key: { in: ["mollie_api_key"] } } });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getMollieConfig(): Promise<MollieConfig | null> {
    const map = await readSettings();
    const apiKey = map.mollie_api_key ?? process.env.MOLLIE_API_KEY ?? null;
    if (!apiKey) return null;
    return { apiKey };
}

export async function isMollieConfigured(): Promise<boolean> {
    return (await getMollieConfig()) !== null;
}

export interface MolliePayment {
    id?: string;
    status?: string;
    amount?: { value?: string; currency?: string };
    amountRefunded?: { value?: string; currency?: string };
    metadata?: Record<string, string> | null;
    _links?: { checkout?: { href?: string } };
    detail?: string;
}

export async function mollieGet(config: MollieConfig, path: string): Promise<MolliePayment> {
    const response = await fetch(`${MOLLIE_API}${path}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) throw new Error(`Mollie answered ${response.status} for ${path}`);
    return (await response.json()) as MolliePayment;
}

/** The currencies Mollie settles. It is a European processor first. */
export const MOLLIE_CURRENCIES = new Set([
    "EUR", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN",
    "USD", "CAD", "AUD", "NZD", "JPY", "HKD", "ILS", "ISK",
]);
