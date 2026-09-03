/**
 * Talking to paysafecard.
 *
 * A paysafecard payment happens in two steps: the buyer authorises it, and the
 * merchant captures it. Money that is authorised and never captured expires
 * back to the buyer, so the notification route must do both - reading a
 * payment as AUTHORIZED and stopping there would show a paid order to nobody
 * and refund itself a few days later.
 */
import { prisma } from "@/core/sdk/server";

const PROD_API = "https://api.paysafecard.com/v1";
const TEST_API = "https://apitest.paysafecard.com/v1";

export interface PaysafecardConfig {
    apiKey: string;
    baseUrl: string;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["paysafecard_api_key", "paysafecard_test_mode"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getPaysafecardConfig(): Promise<PaysafecardConfig | null> {
    const map = await readSettings();
    const apiKey = map.paysafecard_api_key ?? process.env.PAYSAFECARD_API_KEY ?? null;
    if (!apiKey) return null;
    const test = (map.paysafecard_test_mode ?? process.env.PAYSAFECARD_TEST_MODE ?? "") === "true";
    return { apiKey, baseUrl: test ? TEST_API : PROD_API };
}

export async function isPaysafecardConfigured(): Promise<boolean> {
    return (await getPaysafecardConfig()) !== null;
}

export interface PaysafecardPayment {
    id?: string;
    status?: string;
    correlation_id?: string;
    amount?: number | string;
    currency?: string;
    redirect?: { auth_url?: string };
    message?: string;
}

/** paysafecard authenticates with the API key as the Basic username. */
export async function callPaysafecard(
    config: PaysafecardConfig,
    path: string,
    init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<PaysafecardPayment> {
    const response = await fetch(`${config.baseUrl}${path}`, {
        method: init.method,
        headers: {
            Authorization: `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`,
            "Content-Type": "application/json",
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });

    const payload = (await response.json()) as PaysafecardPayment;
    if (!response.ok) {
        throw new Error(`paysafecard answered ${response.status} for ${path}: ${payload.message ?? ""}`);
    }
    return payload;
}

/** The currencies paysafecard settles in. */
export const PAYSAFECARD_CURRENCIES = new Set([
    "EUR", "GBP", "CHF", "PLN", "CZK", "HUF", "RON", "BGN", "DKK", "SEK", "NOK",
    "USD", "CAD", "AUD", "NZD", "MXN", "ARS", "PEN", "UYU", "TRY", "HRK", "GEL",
]);
