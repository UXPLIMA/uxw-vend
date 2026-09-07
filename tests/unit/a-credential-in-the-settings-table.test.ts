import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Eighteen payment credentials sit in the settings table as plain text.
 *
 * The product ships `secret-storage.ts`: AES-256-GCM, versioned, with a
 * documented migration path where a value written without the `v1:` prefix is
 * read as legacy plaintext so callers can encrypt on the next write. Its own
 * header names the case it was built for, "RCON passwords, third-party API
 * tokens". One module uses it: `servers`, for RCON.
 *
 * Every payment gateway reads its key straight out of `Setting` and uses the
 * string as it comes. `/api/v1/settings` writes what it is given, and has no
 * notion of a setting being a secret at all. So a Stripe secret key, a PayPal
 * client secret and sixteen more live in a column any database dump carries,
 * and this product makes those dumps itself and keeps them in `backups/`.
 *
 * This file does not fix that. Encrypting at rest means marking which
 * settings are secrets, encrypting on write, decrypting in twelve modules'
 * readers and migrating what is already stored, and it touches the payment
 * path, which is where this repository says to escalate rather than guess.
 *
 * What it does is stop the number growing while the decision is open. The
 * list may shrink freely, as each key moves behind `encryptSecret`. A
 * nineteenth arrives with the conversation, not without it.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * The eighteen as measured on 2026-09-07, by reading the key names each
 * gateway asks `prisma.setting` for.
 */
const PLAINTEXT_CREDENTIALS = new Set([
    "coinbase_api_key",
    "coinbase_webhook_secret",
    "coinpayments_ipn_secret",
    "iyzico_api_key",
    "iyzico_secret_key",
    "mercadopago_access_token",
    "mercadopago_webhook_secret",
    "mollie_api_key",
    "nowpayments_api_key",
    "nowpayments_ipn_secret",
    "param_client_password",
    "paymentwall_secret_key",
    "paypal_client_secret",
    "paysafecard_api_key",
    "razorpay_key_secret",
    "razorpay_webhook_secret",
    "stripe_secret_key",
    "stripe_webhook_secret",
]);

const LOOKS_LIKE_A_CREDENTIAL = /secret|password|token|api_key|apikey|private/i;

function tsFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "generated") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (full.endsWith(path.join("src", "modules"))) continue;
            tsFiles(full, out);
        } else if (entry.name.endsWith(".ts")) out.push(full);
    }
    return out;
}

/** Setting keys any code asks the database for. */
function settingKeysRead(): Map<string, string> {
    const found = new Map<string, string>();
    for (const file of [...tsFiles(path.join(ROOT, "module-sources")), ...tsFiles(path.join(ROOT, "src"))]) {
        const body = fs.readFileSync(file, "utf8");
        if (!body.includes("prisma.setting")) continue;
        for (const m of body.matchAll(/key:\s*\{\s*in:\s*\[([^\]]*)\]/g)) {
            for (const k of m[1].matchAll(/"([^"]+)"/g)) {
                if (!found.has(k[1])) found.set(k[1], path.relative(ROOT, file));
            }
        }
        for (const m of body.matchAll(/key:\s*"([^"]+)"/g)) {
            if (!found.has(m[1])) found.set(m[1], path.relative(ROOT, file));
        }
    }
    return found;
}

describe("a credential kept in the settings table", () => {
    const read = settingKeysRead();

    it("finds the settings the product reads", () => {
        expect(read.size).toBeGreaterThan(40);
    });

    it("is one of the ones already known about", () => {
        const unpinned = [...read.entries()]
            .filter(([key]) => LOOKS_LIKE_A_CREDENTIAL.test(key))
            .filter(([key]) => !PLAINTEXT_CREDENTIALS.has(key))
            .map(([key, file]) => `${key}  (${file})`);

        expect(
            unpinned,
            `A new credential is being kept in the settings table as plain text.\n` +
            `The product has secret-storage.ts for this; using it needs a decision\n` +
            `about marking, migrating and the twelve readers, so make it rather\n` +
            `than adding to the list:\n${unpinned.join("\n")}`,
        ).toEqual([]);
    });

    it("keeps the pinned list free of names nobody reads any more", () => {
        const gone = [...PLAINTEXT_CREDENTIALS].filter((key) => !read.has(key));
        expect(
            gone,
            `These are pinned as plaintext credentials and nothing reads them.\n` +
            `Either they moved behind encryptSecret, in which case take them out\n` +
            `of the list, or they are gone:\n${gone.join("\n")}`,
        ).toEqual([]);
    });
});
