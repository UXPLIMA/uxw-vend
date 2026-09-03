/**
 * Talking to iyzico.
 *
 * iyzico signs every request with a HMAC over the random key, the path and the
 * body, in that order. Getting any of the three wrong produces the same
 * "invalid signature" as a wrong secret, so the signing lives here alone and
 * every call goes through `callIyzico`.
 */
import crypto from "crypto";
import { prisma } from "@/core/sdk/server";

const PROD_URL = "https://api.iyzipay.com";
const SANDBOX_URL = "https://sandbox-api.iyzipay.com";

export interface IyzicoConfig {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["iyzico_api_key", "iyzico_secret_key", "iyzico_sandbox"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getIyzicoConfig(): Promise<IyzicoConfig | null> {
    const map = await readSettings();
    const apiKey = map.iyzico_api_key ?? process.env.IYZICO_API_KEY ?? null;
    const secretKey = map.iyzico_secret_key ?? process.env.IYZICO_SECRET_KEY ?? null;
    if (!apiKey || !secretKey) return null;

    const sandbox = (map.iyzico_sandbox ?? process.env.IYZICO_SANDBOX ?? "") === "true";
    return { apiKey, secretKey, baseUrl: sandbox ? SANDBOX_URL : PROD_URL };
}

export async function isIyzicoConfigured(): Promise<boolean> {
    return (await getIyzicoConfig()) !== null;
}

/** iyzico prices are strings with a decimal point, never a comma. */
export function iyzicoAmount(amount: number): string {
    return amount.toFixed(2);
}

/**
 * The IYZWSv2 authorization header.
 *
 * `payload` is the random key, the request path and the raw body concatenated
 * in that order - not the body alone, which is the mistake that costs an
 * afternoon.
 */
function authorization(config: IyzicoConfig, uriPath: string, body: string, randomKey: string): string {
    const signature = crypto
        .createHmac("sha256", config.secretKey)
        .update(randomKey + uriPath + body)
        .digest("hex");
    const params = `apiKey:${config.apiKey}&randomKey:${randomKey}&signature:${signature}`;
    return `IYZWSv2 ${Buffer.from(params).toString("base64")}`;
}

export async function callIyzico<T>(config: IyzicoConfig, uriPath: string, payload: unknown): Promise<T> {
    const body = JSON.stringify(payload);
    const randomKey = `${Date.now()}${crypto.randomBytes(8).toString("hex")}`;

    const response = await fetch(`${config.baseUrl}${uriPath}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authorization(config, uriPath, body, randomKey),
            "x-iyzi-rnd": randomKey,
        },
        body,
    });

    if (!response.ok) {
        throw new Error(`iyzico answered ${response.status} for ${uriPath}`);
    }
    return (await response.json()) as T;
}

export interface IyzicoFormResult {
    status: string;
    errorMessage?: string;
    token?: string;
    paymentPageUrl?: string;
}

export interface IyzicoPaymentDetail {
    status: string;
    errorMessage?: string;
    paymentStatus?: string;
    paymentId?: string;
    basketId?: string;
    paidPrice?: string;
    currency?: string;
}

/** The currencies iyzico settles in. TRY is the one it exists for. */
export const IYZICO_CURRENCIES = new Set(["TRY", "USD", "EUR", "GBP", "IRR", "NOK", "RUB", "CHF"]);
