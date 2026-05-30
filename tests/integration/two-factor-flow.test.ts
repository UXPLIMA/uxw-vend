// @vitest-environment node
/**
 * 2FA flow integration tests.
 *
 * The full Credentials.authorize() path (with bcrypt, lockout, 2FA, backup
 * codes) lives inline in `src/core/lib/auth.ts` and isn't exported as a
 * standalone function. Worse, importing `@/core/lib/auth` in the test env
 * fails outright — NextAuth's runtime can't resolve `next/server` outside the
 * Next bundler — so the inline authorize() cannot be driven directly here.
 *
 * Per the test plan, each previously-`it.todo` end-to-end case is therefore
 * implemented as a focused test of the exact helper(s) auth.ts composes for
 * that scenario, reproducing authorize()'s decision logic step for step:
 *
 *  - wrong 2FA code  -> verifyTokenWithReplayProtection AND verifyBackupCode
 *    both reject, so authorize() throws INVALID_2FA and counts a failure.
 *  - correct TOTP    -> verifyTokenWithReplayProtection accepts (auth proceeds).
 *  - backup code     -> verifyBackupCode consumes the code and returns the
 *    trimmed list that authorize() persists via prisma.user.update.
 *  - lockout         -> registerFailedLogin increments to MAX_ATTEMPTS, arms
 *    lockedUntil, and getLockoutStatus (the pre-bcrypt gate in authorize)
 *    then reports `locked: true` on the next attempt.
 *
 * What we also keep here:
 *  - The TOTP replay-protection contract from W2 task 16.
 *  - The backup-code single-use contract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as OTPAuth from "otpauth";
import {
    generateBackupCodes,
    verifyBackupCode,
    hashBackupCode as hashBackupCodeFor,
} from "@/core/lib/two-factor";

// In-memory cache shared by all calls so replay protection actually fires.
const memCache = new Map<string, string>();
vi.mock("@/core/lib/redis", () => ({
    cacheGet: async (k: string) => memCache.get(k) ?? null,
    cacheSet: async (k: string, v: string) => { memCache.set(k, v); },
    getRedisClient: async () => null,
    isRedisConfigured: () => false,
}));

// In-memory user store backing the account-lockout helpers (which read/write
// via prisma.user.findUnique/update). Lets us drive the real lockout counter.
type LockUser = {
    id: string;
    failedLoginAttempts: number;
    lastFailedLoginAt: Date | null;
    lockedUntil: Date | null;
    email: string | null;
    username: string | null;
    locale: string | null;
};
const lockUsers = new Map<string, LockUser>();
vi.mock("@/core/lib/db", () => ({
    prisma: {
        user: {
            findUnique: async ({ where }: { where: { id: string } }) => lockUsers.get(where.id) ?? null,
            update: async ({ where, data }: { where: { id: string }; data: Partial<LockUser> }) => {
                const u = lockUsers.get(where.id);
                if (u) Object.assign(u, data);
                return u;
            },
        },
    },
}));
// Lockout's threshold email import is best-effort; stub it so crossing the
// threshold doesn't try to send mail.
vi.mock("@/core/lib/email", () => ({
    sendAccountLockoutEmail: async () => {},
}));

beforeEach(() => {
    memCache.clear();
    lockUsers.clear();
});

// Helper mirroring authorize()'s 2FA decision: try replay-protected TOTP
// first, then a backup code; on success return the (possibly trimmed) code
// list, on failure signal that authorize() would throw INVALID_2FA.
async function authorizeTwoFactor(params: {
    userId: string;
    secret: string;
    code: string;
    backupCodes: string[];
}): Promise<{ ok: true; remaining: string[] } | { ok: false }> {
    const { verifyTokenWithReplayProtection } = await import("@/core/lib/two-factor");
    const okTotp = await verifyTokenWithReplayProtection(params.userId, params.secret, params.code);
    if (okTotp) return { ok: true, remaining: params.backupCodes };
    const { valid, remaining } = verifyBackupCode(params.code, params.backupCodes);
    if (!valid) return { ok: false };
    return { ok: true, remaining };
}

function makeTotp(): { secret: string; code: string } {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
    });
    return { secret, code: totp.generate() };
}

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

describe("2FA: credentials.authorize 2FA decision (helper-level)", () => {
    // Each case reproduces the exact branch authorize() takes after a valid
    // password, using the same helpers authorize() imports. (authorize()
    // itself can't be imported in this env — see file header.)

    it("rejects login with correct password but wrong 2FA code", async () => {
        const { secret } = makeTotp();
        const { hashed } = generateBackupCodes(3);
        // Password already validated upstream; here the supplied 2FA code is
        // neither a valid TOTP nor a backup code -> authorize() throws INVALID_2FA.
        const result = await authorizeTwoFactor({
            userId: "user-2fa-wrong",
            secret,
            code: "000000",
            backupCodes: hashed,
        });
        expect(result.ok).toBe(false);
    });

    it("accepts login with correct password + valid TOTP code", async () => {
        const { secret, code } = makeTotp();
        const result = await authorizeTwoFactor({
            userId: "user-2fa-totp",
            secret,
            code,
            backupCodes: [],
        });
        expect(result.ok).toBe(true);
    });

    it("accepts login with a backup code AND removes it from storage", async () => {
        const { secret } = makeTotp();
        const { codes, hashed } = generateBackupCodes(3);
        const used = codes[2];

        // First use: TOTP fails (we pass a backup code), backup path consumes it.
        const r1 = await authorizeTwoFactor({
            userId: "user-2fa-backup",
            secret,
            code: used,
            backupCodes: hashed,
        });
        expect(r1.ok).toBe(true);
        if (r1.ok) {
            expect(r1.remaining).toHaveLength(2);
            expect(r1.remaining).not.toContain(hashBackupCodeFor(used));

            // Replaying the SAME backup code against the persisted (trimmed)
            // list is rejected — single-use, just like authorize() enforces.
            const r2 = await authorizeTwoFactor({
                userId: "user-2fa-backup",
                secret,
                code: used,
                backupCodes: r1.remaining,
            });
            expect(r2.ok).toBe(false);
        }
    });
});

describe("2FA: account lockout (real account-lockout helpers)", () => {
    it("locks the account after 10 wrong-password attempts and the 11th is gated before bcrypt", async () => {
        const { registerFailedLogin } = await import("@/core/lib/account-lockout");
        const { getLockoutStatus, ACCOUNT_LOCKOUT_CONFIG } = await import("@/core/lib/account-lockout");

        const userId = "user-lockout";
        lockUsers.set(userId, {
            id: userId,
            failedLoginAttempts: 0,
            lastFailedLoginAt: null,
            lockedUntil: null,
            email: "victim@example.com",
            username: "victim",
            locale: "en",
        });

        // authorize() calls getLockoutStatus(user) BEFORE bcrypt; on a wrong
        // password it calls registerFailedLogin(). Simulate N=MAX_ATTEMPTS
        // wrong passwords. Each attempt must NOT be locked beforehand until
        // the threshold is crossed.
        const max = ACCOUNT_LOCKOUT_CONFIG.MAX_ATTEMPTS;
        expect(max).toBe(10);

        for (let i = 0; i < max; i++) {
            const before = getLockoutStatus(lockUsers.get(userId)!);
            expect(before.locked).toBe(false); // not locked while still under threshold
            await registerFailedLogin(userId, { ip: "1.2.3.4" });
        }

        // After the 10th failed attempt the account is armed.
        const user = lockUsers.get(userId)!;
        expect(user.failedLoginAttempts).toBe(max);
        expect(user.lockedUntil).toBeInstanceOf(Date);

        // The 11th attempt: authorize()'s pre-bcrypt gate now reports locked
        // and would throw ACCOUNT_LOCKED instead of checking the password.
        const at11 = getLockoutStatus(user);
        expect(at11.locked).toBe(true);
        expect(at11.until).toBeGreaterThan(Date.now());
    });
});
