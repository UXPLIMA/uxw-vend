// @vitest-environment node
/**
 * 2FA flow integration tests.
 *
 * The full Credentials.authorize() path (with bcrypt, lockout, 2FA, backup
 * codes) lives inline in `src/core/lib/auth.ts` and isn't exported as a
 * standalone function. Calling it end-to-end requires either a real Prisma
 * client (DB up) or hand-rolling a JWT/cookie roundtrip through Auth.js's
 * internals — both out of scope for a pure unit test harness.
 *
 * What we cover here:
 *  - The TOTP replay-protection contract from W2 task 16
 *    (`verifyTokenWithReplayProtection`)
 *  - The backup-code single-use contract that auth.ts depends on
 *    (`verifyBackupCode` removes the used hash from the remaining list)
 *
 * The end-to-end credential auth flow + lockout integration is marked
 * `it.todo` below — they need either:
 *   - A Postgres test DB + seeded user fixture
 *   - OR a Prisma mock harness deep enough to satisfy
 *     auth.ts's findUnique/update calls plus account-lockout's reads.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as OTPAuth from "otpauth";
import {
    generateBackupCodes,
    verifyBackupCode,
} from "@/core/lib/two-factor";

// In-memory cache shared by all calls so replay protection actually fires.
const memCache = new Map<string, string>();
vi.mock("@/core/lib/redis", () => ({
    cacheGet: async (k: string) => memCache.get(k) ?? null,
    cacheSet: async (k: string, v: string) => { memCache.set(k, v); },
    getRedisClient: async () => null,
    isRedisConfigured: () => false,
}));

beforeEach(() => {
    memCache.clear();
});

describe("2FA: TOTP replay protection (W2 task 16)", () => {
    it("accepts a valid TOTP once and rejects the same code within the window", async () => {
        const { verifyTokenWithReplayProtection } = await import("@/core/lib/two-factor");

        // Generate a real TOTP using otpauth (same library auth.ts uses) so
        // verifyToken accepts it.
        const secret = new OTPAuth.Secret({ size: 20 }).base32;
        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 });
        const code = totp.generate();

        const userId = "user-replay-1";

        const first = await verifyTokenWithReplayProtection(userId, secret, code);
        expect(first).toBe(true);

        // Same code, same userId, within the 120s window -> rejected.
        const second = await verifyTokenWithReplayProtection(userId, secret, code);
        expect(second).toBe(false);
    });

    it("rejects malformed (non-6/8-digit) tokens before checking replay", async () => {
        const { verifyTokenWithReplayProtection } = await import("@/core/lib/two-factor");
        const result = await verifyTokenWithReplayProtection("u1", "AAAAAAAAAAAAAAAA", "abc");
        expect(result).toBe(false);
    });
});

describe("2FA: backup-code single-use", () => {
    it("removes a used backup code from the remaining list", () => {
        const { codes, hashed } = generateBackupCodes(3);
        const used = codes[1];

        const r1 = verifyBackupCode(used, hashed);
        expect(r1.valid).toBe(true);
        expect(r1.remaining).toHaveLength(2);

        // Replay the same code against the trimmed list -> rejected.
        const r2 = verifyBackupCode(used, r1.remaining);
        expect(r2.valid).toBe(false);
        expect(r2.remaining).toEqual(r1.remaining);
    });
});

describe("2FA: full credentials.authorize flow (DB-dependent)", () => {
    // These cases need a real Prisma client + seeded user fixture, or a
    // mock harness deep enough to satisfy:
    //   - prisma.user.findUnique({ include: { role: true } })
    //   - account-lockout: prisma.user.findUnique + update
    //   - prisma.user.update for backupCodes consumption
    //   - resetFailedLogins update
    // Wire these up against a test DB when the harness exists.

    it.todo("rejects login with correct password but wrong 2FA code");
    it.todo("accepts login with correct password + valid TOTP code");
    it.todo("accepts login with backup code AND removes it from storage");
    it.todo("locks account after 10 wrong-password attempts and rejects the 11th");
});
