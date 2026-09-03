/**
 * Talking to Mercado Pago.
 *
 * The payment is a Checkout Pro preference: Mercado Pago hosts the page and
 * offers whatever is local to the buyer's country - card, Pix, boleto, cash at
 * a shop. The webhook that follows carries a payment id and nothing else, so
 * the status is always read back with the account's access token.
 */
import crypto from "crypto";
import { prisma } from "@/core/sdk/server";

export const MERCADOPAGO_API = "https://api.mercadopago.com";

export interface MercadoPagoConfig {
    accessToken: string;
    webhookSecret: string | null;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["mercadopago_access_token", "mercadopago_webhook_secret"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getMercadoPagoConfig(): Promise<MercadoPagoConfig | null> {
    const map = await readSettings();
    const accessToken = map.mercadopago_access_token ?? process.env.MERCADOPAGO_ACCESS_TOKEN ?? null;
    if (!accessToken) return null;
    return {
        accessToken,
        webhookSecret: map.mercadopago_webhook_secret ?? process.env.MERCADOPAGO_WEBHOOK_SECRET ?? null,
    };
}

export async function isMercadoPagoConfigured(): Promise<boolean> {
    return (await getMercadoPagoConfig()) !== null;
}

export interface MercadoPagoPayment {
    id?: number | string;
    status?: string;
    external_reference?: string;
    transaction_amount?: number;
    currency_id?: string;
    metadata?: Record<string, string>;
}

export async function mercadoPagoGet(
    config: MercadoPagoConfig,
    path: string,
): Promise<MercadoPagoPayment> {
    const response = await fetch(`${MERCADOPAGO_API}${path}`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!response.ok) throw new Error(`Mercado Pago answered ${response.status} for ${path}`);
    return (await response.json()) as MercadoPagoPayment;
}

/**
 * The `x-signature` header, when the account has webhook signing switched on.
 *
 * Mercado Pago signs a manifest built from the payment id, the request id and
 * the timestamp - not the body - so the three have to be assembled in that
 * exact order.
 */
export function webhookManifestSignature(
    secret: string,
    parts: { dataId: string; requestId: string; timestamp: string },
): string {
    const manifest = `id:${parts.dataId};request-id:${parts.requestId};ts:${parts.timestamp};`;
    return crypto.createHmac("sha256", secret).update(manifest).digest("hex");
}

/** Reads `ts=...,v1=...` out of the x-signature header. */
export function parseSignatureHeader(header: string): { ts: string; v1: string } | null {
    const parts: Record<string, string> = {};
    for (const piece of header.split(",")) {
        const [key, value] = piece.split("=", 2);
        if (key && value) parts[key.trim()] = value.trim();
    }
    if (!parts.ts || !parts.v1) return null;
    return { ts: parts.ts, v1: parts.v1 };
}

/** The currencies Mercado Pago settles, one per country it operates in. */
export const MERCADOPAGO_CURRENCIES = new Set(["ARS", "BRL", "CLP", "COP", "MXN", "PEN", "UYU"]);
