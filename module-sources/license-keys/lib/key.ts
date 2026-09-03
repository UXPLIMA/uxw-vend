/**
 * Making, storing and reading back a license key.
 *
 * A key is not a password: the buyer has to be able to see it again, print it,
 * and paste it into software months later. So it cannot simply be hashed. It
 * is kept two ways instead - hashed for lookup, encrypted for display - so
 * that a database dump on its own yields nothing anyone can activate.
 */
import crypto from "crypto";
import { encryptSecret, decryptSecret } from "@/core/sdk/server";

/**
 * Crockford's alphabet minus the vowels: no O/0, no I/1, and nothing that can
 * accidentally spell a word in a customer's key.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";
const BLOCK_LENGTH = 5;
const BLOCKS = 4;

/** 32^20, which is about 10^30. */
export function generateKey(prefix?: string | null): string {
    const blocks: string[] = [];
    for (let b = 0; b < BLOCKS; b++) {
        const chars: string[] = [];
        while (chars.length < BLOCK_LENGTH) {
            for (const byte of crypto.randomBytes(BLOCK_LENGTH)) {
                // 224 is the largest multiple of 32 below 256; anything above
                // is redrawn rather than folded, which would bias the alphabet.
                if (byte >= 224) continue;
                chars.push(ALPHABET[byte % ALPHABET.length]);
                if (chars.length === BLOCK_LENGTH) break;
            }
        }
        blocks.push(chars.join(""));
    }
    const clean = normalizePrefix(prefix);
    return [...(clean ? [clean] : []), ...blocks].join("-");
}

function normalizePrefix(prefix?: string | null): string {
    return (prefix ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/**
 * Customers retype keys with the wrong case, with spaces, and without the
 * dashes. All three mean the same key.
 */
export function normalizeKey(key: string): string {
    return key.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashKey(key: string): string {
    return crypto.createHash("sha256").update(normalizeKey(key)).digest("hex");
}

/** A machine fingerprint is the customer's data; this module keeps only its hash. */
export function hashMachine(machineId: string): string {
    return crypto.createHash("sha256").update(machineId.trim()).digest("hex");
}

export function sealKey(key: string): string {
    return encryptSecret(key);
}

export function unsealKey(sealed: string): string {
    return decryptSecret(sealed);
}

/** The leading block, which is enough for a support agent to match a key. */
export function keyHint(key: string): string {
    return key.split("-").slice(0, 2).join("-");
}
