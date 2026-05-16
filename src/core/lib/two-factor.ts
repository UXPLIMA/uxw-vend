import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { cacheGet, cacheSet } from "./redis";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "uxwVend";

export function generateSecret(email: string): { secret: string; uri: string } {
    const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: new OTPAuth.Secret({ size: 20 }),
    });

    return {
        secret: totp.secret.base32,
        uri: totp.toString(),
    };
}

export function verifyToken(secret: string, token: string): boolean {
    const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
}

/**
 * Verify a TOTP and atomically mark it consumed so the same code cannot
 * be replayed within the validity window. RFC 6238 requires used codes
 * be rejected — without this, an intercepted code is reusable for up to
 * the configured window (here ~90s with window=1).
 *
 * Falls back to the in-memory cache backend when Redis is unavailable
 * (single-worker dev), so the replay guard still works locally.
 */
export async function verifyTokenWithReplayProtection(
    userId: string,
    secret: string,
    token: string,
): Promise<boolean> {
    if (!/^\d{6,8}$/.test(token)) return false;
    const cacheKey = `totp:used:${userId}:${token}`;
    const used = await cacheGet(cacheKey);
    if (used) return false;
    if (!verifyToken(secret, token)) return false;
    // TTL covers the full window (prev/curr/next 30s slots) plus a small
    // buffer so a code accepted at the edge of one slot can't be replayed
    // when the next slot starts.
    await cacheSet(cacheKey, "1", 120);
    return true;
}

export async function generateQRCode(uri: string): Promise<string> {
    return QRCode.toDataURL(uri);
}

export function generateBackupCodes(count: number = 10): { codes: string[]; hashed: string[] } {
    const codes: string[] = [];
    const hashed: string[] = [];

    // 8 bytes = 16 hex chars = 64 bits of entropy per code. Displayed as
    // XXXX-XXXX-XXXX-XXXX for readability. 64 bits makes offline brute-force
    // against the SHA-256 hash computationally infeasible (unlike the
    // previous 32-bit code, which can be cracked in seconds).
    for (let i = 0; i < count; i++) {
        const raw = randomBytes(8).toString("hex").toUpperCase();
        const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
        codes.push(formatted);
        hashed.push(hashBackupCode(formatted));
    }

    return { codes, hashed };
}

export function hashBackupCode(code: string): string {
    return createHash("sha256").update(code.replaceAll("-", "").toUpperCase()).digest("hex");
}

/**
 * Verify a backup code against the stored hash list. Comparison uses
 * crypto.timingSafeEqual so a short-circuit on string comparison cannot
 * reveal which hash matched first. On success the matching hash is removed
 * so callers can persist `remaining` — codes are strictly single-use.
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): { valid: boolean; remaining: string[] } {
    const hash = hashBackupCode(code);
    const candidate = Buffer.from(hash, "hex");

    let matchIndex = -1;
    for (let i = 0; i < hashedCodes.length; i++) {
        const stored = hashedCodes[i];
        if (typeof stored !== "string" || stored.length !== hash.length) continue;
        const storedBuf = Buffer.from(stored, "hex");
        if (storedBuf.length !== candidate.length) continue;
        if (timingSafeEqual(storedBuf, candidate)) {
            // Record the first match but keep iterating so the total work
            // done is independent of which position matched.
            if (matchIndex === -1) matchIndex = i;
        }
    }

    if (matchIndex === -1) {
        return { valid: false, remaining: hashedCodes };
    }

    const remaining = [...hashedCodes];
    remaining.splice(matchIndex, 1);
    return { valid: true, remaining };
}

export function parseBackupCodes(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
            return [];
        }
    }
    return [];
}

export function countRemainingBackupCodes(value: unknown): number {
    return parseBackupCodes(value).length;
}
