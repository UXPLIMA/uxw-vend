/**
 * Talking to Midtrans.
 *
 * The payment is a Snap transaction: Midtrans hosts the page and offers what
 * Indonesian buyers use - bank transfer, e-wallets, convenience store cash,
 * cards. Rupiah has no minor unit, so the gross amount is a whole number and
 * gets rounded once, here, rather than in three places.
 */
import crypto from "crypto";
import { prisma } from "@/core/sdk/server";

const PROD_SNAP = "https://app.midtrans.com/snap/v1/transactions";
const SANDBOX_SNAP = "https://app.sandbox.midtrans.com/snap/v1/transactions";

export interface MidtransConfig {
    serverKey: string;
    snapUrl: string;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: ["midtrans_server_key", "midtrans_test_mode"] } },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getMidtransConfig(): Promise<MidtransConfig | null> {
    const map = await readSettings();
    const serverKey = map.midtrans_server_key ?? process.env.MIDTRANS_SERVER_KEY ?? null;
    if (!serverKey) return null;
    const test = (map.midtrans_test_mode ?? process.env.MIDTRANS_TEST_MODE ?? "") === "true";
    return { serverKey, snapUrl: test ? SANDBOX_SNAP : PROD_SNAP };
}

export async function isMidtransConfigured(): Promise<boolean> {
    return (await getMidtransConfig()) !== null;
}

export function midtransAuth(config: MidtransConfig): string {
    return `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`;
}

/**
 * The signature on a notification: SHA-512 of the order id, the status code,
 * the gross amount as Midtrans wrote it, and the server key. The amount is
 * used as the string that arrived - reformatting it changes the hash.
 */
export function notificationSignature(
    serverKey: string,
    parts: { orderId: string; statusCode: string; grossAmount: string },
): string {
    return crypto
        .createHash("sha512")
        .update(parts.orderId + parts.statusCode + parts.grossAmount + serverKey)
        .digest("hex");
}

/**
 * Midtrans order ids allow letters, digits and a few punctuation marks, and
 * our references are cuids, which fit. Anything else is hex-encoded so the
 * notification can turn it back into the reference the store knows.
 */
export function toOrderId(reference: string): string {
    if (/^[a-zA-Z0-9._-]+$/.test(reference)) return reference;
    return `hx${Buffer.from(reference, "utf8").toString("hex")}`;
}

export function fromOrderId(orderId: string): string {
    if (!orderId.startsWith("hx")) return orderId;
    return Buffer.from(orderId.slice(2), "hex").toString("utf8");
}
