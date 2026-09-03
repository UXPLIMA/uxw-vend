/**
 * Talking to Paymentwall.
 *
 * Paymentwall is not an API you post an order to: the payment is a widget URL,
 * signed with the project secret, and the result comes back as a pingback that
 * is signed the same way. So the signature is the whole integration, and both
 * directions use the one function below.
 *
 * Signature version 3 (SHA-256) is used rather than the older version 2, which
 * is MD5. Both are accepted by Paymentwall; only one of them is worth signing
 * a payment with.
 */
import crypto from "crypto";
import { prisma } from "@/core/sdk/server";

export const PAYMENTWALL_WIDGET = "https://api.paymentwall.com/api/subscription";

export interface PaymentwallConfig {
    projectKey: string;
    secretKey: string;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["paymentwall_project_key", "paymentwall_secret_key"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getPaymentwallConfig(): Promise<PaymentwallConfig | null> {
    const map = await readSettings();
    const projectKey = map.paymentwall_project_key ?? process.env.PAYMENTWALL_PROJECT_KEY ?? null;
    const secretKey = map.paymentwall_secret_key ?? process.env.PAYMENTWALL_SECRET_KEY ?? null;
    if (!projectKey || !secretKey) return null;
    return { projectKey, secretKey };
}

export async function isPaymentwallConfigured(): Promise<boolean> {
    return (await getPaymentwallConfig()) !== null;
}

/**
 * Paymentwall's signature: every parameter except the signature itself, sorted
 * by name, written as `name=value` with no separator between pairs, then the
 * secret, then SHA-256 of the lot.
 */
export function paymentwallSign(params: Record<string, string>, secret: string): string {
    const base = Object.keys(params)
        .filter((key) => key !== "sig")
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("");
    return crypto.createHash("sha256").update(base + secret, "utf8").digest("hex");
}

/**
 * What a pingback is telling us. Paymentwall numbers them: 0 and 1 deliver the
 * goods, 2 takes them back after a chargeback, 3 is a refund.
 */
export function pingbackKind(type: string): "deliver" | "withdraw" | "unknown" {
    if (type === "0" || type === "1") return "deliver";
    if (type === "2" || type === "3") return "withdraw";
    return "unknown";
}

/** The currencies Paymentwall prices a widget in. */
export const PAYMENTWALL_CURRENCIES = new Set([
    "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK",
    "JPY", "SGD", "HKD", "NZD", "INR", "BRL", "MXN", "TRY", "ZAR", "RUB", "UAH", "KRW",
]);
