/**
 * Talking to Param (TurkPos).
 *
 * Param's API is SOAP, and the parts of it this module needs are three small
 * documents. Rather than pull in an XML stack for that, the envelopes are
 * built as strings and read back with a tag reader: the responses are flat
 * lists of scalars, which is the one shape that treatment is safe for.
 *
 * Two Param details worth knowing before changing anything here: amounts are
 * written with a comma as the decimal separator, and the hash is a base64
 * SHA-256 of concatenated fields in a fixed order, not an HMAC.
 */
import crypto from "crypto";
import { prisma } from "@/core/sdk/server";

const PROD_URL = "https://posws.param.com.tr/turkpos.ws/service_turkpos_prod.asmx";
const TEST_URL = "https://testposws.param.com.tr/turkpos.ws/service_turkpos_test.asmx";

export interface ParamConfig {
    clientCode: string;
    username: string;
    password: string;
    guid: string;
    baseUrl: string;
}

async function readSettings(): Promise<Record<string, string | null>> {
    const rows = await prisma.setting.findMany({
        where: {
            key: {
                in: [
                    "param_client_code",
                    "param_client_username",
                    "param_client_password",
                    "param_guid",
                    "param_test_mode",
                ],
            },
        },
    });
    const map: Record<string, string | null> = {};
    for (const row of rows) {
        const value = row.value;
        map[row.key] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
    return map;
}

export async function getParamConfig(): Promise<ParamConfig | null> {
    const map = await readSettings();
    const clientCode = map.param_client_code ?? process.env.PARAM_CLIENT_CODE ?? null;
    const username = map.param_client_username ?? process.env.PARAM_CLIENT_USERNAME ?? null;
    const password = map.param_client_password ?? process.env.PARAM_CLIENT_PASSWORD ?? null;
    const guid = map.param_guid ?? process.env.PARAM_GUID ?? null;
    if (!clientCode || !username || !password || !guid) return null;

    const test = (map.param_test_mode ?? process.env.PARAM_TEST_MODE ?? "") === "true";
    return { clientCode, username, password, guid, baseUrl: test ? TEST_URL : PROD_URL };
}

export async function isParamConfigured(): Promise<boolean> {
    return (await getParamConfig()) !== null;
}

/** Param writes money the Turkish way: 1.234,56. */
export function paramAmount(amount: number): string {
    return amount.toFixed(2).replace(".", ",");
}

/** And reads it back the same way. */
export function parseParamAmount(value: string): number {
    return Number(value.replace(/\./g, "").replace(",", ".")) || 0;
}

/** Param calls this SHA2B64: base64 of the SHA-256 of the concatenation. */
export function paramHash(parts: string): string {
    return crypto.createHash("sha256").update(parts, "utf8").digest("base64");
}

/** XML text has to survive being pasted into an envelope. */
export function xmlEscape(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/** First value of a flat scalar tag, unescaped. */
export function readTag(xml: string, tag: string): string | null {
    const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
    if (!match) return null;
    return match[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .trim();
}

export async function callParam(config: ParamConfig, action: string, inner: string): Promise<string> {
    const envelope =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
        ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"' +
        ' xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
        `<${action} xmlns="https://turkpos.com.tr/">` +
        `<G><CLIENT_CODE>${xmlEscape(config.clientCode)}</CLIENT_CODE>` +
        `<CLIENT_USERNAME>${xmlEscape(config.username)}</CLIENT_USERNAME>` +
        `<CLIENT_PASSWORD>${xmlEscape(config.password)}</CLIENT_PASSWORD></G>` +
        `<GUID>${xmlEscape(config.guid)}</GUID>` +
        inner +
        `</${action}></soap:Body></soap:Envelope>`;

    const response = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: `https://turkpos.com.tr/${action}`,
        },
        body: envelope,
    });

    if (!response.ok) throw new Error(`Param answered ${response.status} for ${action}`);
    return await response.text();
}
