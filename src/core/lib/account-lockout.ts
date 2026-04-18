import { prisma } from "./db";

/**
 * Progressive account lockout after repeated failed logins.
 *
 * IP-based rate limiting slows a single attacker host, but a distributed
 * credential-stuffing campaign can spray a victim account from thousands
 * of addresses without tripping any IP bucket. Per-account throttling is
 * the mitigation: every wrong password increments a counter; once the
 * counter crosses MAX_ATTEMPTS in MAX_WINDOW_MS, the account is locked
 * for LOCKOUT_MS and further password checks short-circuit with the
 * same "invalid credentials" signal so the attacker gets no information
 * about why the attempt failed.
 *
 * A successful login always resets the counter — legitimate users who
 * mistype twice then get it right never see the lock.
 */

const MAX_ATTEMPTS = (() => {
    const raw = Number(process.env.ACCOUNT_LOCKOUT_ATTEMPTS);
    return Number.isFinite(raw) && raw > 0 ? raw : 10;
})();

const MAX_WINDOW_MS = (() => {
    const raw = Number(process.env.ACCOUNT_LOCKOUT_WINDOW_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : 15 * 60 * 1000;
})();

const LOCKOUT_MS = (() => {
    const raw = Number(process.env.ACCOUNT_LOCKOUT_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : 15 * 60 * 1000;
})();

export interface LockoutStatus {
    locked: boolean;
    /** Unix ms timestamp when the lock lifts. Undefined when not locked. */
    until?: number;
}

/**
 * Check whether the account is currently locked out. Called before password
 * verification so a locked account short-circuits without spending bcrypt.
 */
export function getLockoutStatus(user: {
    lockedUntil: Date | null;
} | null | undefined): LockoutStatus {
    if (!user?.lockedUntil) return { locked: false };
    const until = user.lockedUntil.getTime();
    if (until <= Date.now()) return { locked: false };
    return { locked: true, until };
}

/**
 * Called after a failed password attempt. Increments the counter and
 * arms the lock when the threshold is reached. Any prior failure older
 * than MAX_WINDOW_MS resets the counter before incrementing so a user
 * with three fumbled logins a month apart never gets locked.
 */
export async function registerFailedLogin(userId: string): Promise<void> {
    try {
        const existing = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                failedLoginAttempts: true,
                lastFailedLoginAt: true,
            },
        });
        if (!existing) return;

        const now = Date.now();
        const lastAt = existing.lastFailedLoginAt?.getTime() ?? 0;
        const withinWindow = now - lastAt <= MAX_WINDOW_MS;
        const nextAttempts = (withinWindow ? existing.failedLoginAttempts : 0) + 1;
        const lockedUntil =
            nextAttempts >= MAX_ATTEMPTS ? new Date(now + LOCKOUT_MS) : null;

        await prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: nextAttempts,
                lastFailedLoginAt: new Date(now),
                lockedUntil,
            },
        });
    } catch (err) {
        console.error("[account-lockout] registerFailedLogin failed:", err);
    }
}

/**
 * Called after a successful login. Resets the failure counter + clears
 * any residual lock so the next legitimate login is never accidentally
 * blocked by an old stale state.
 */
export async function resetFailedLogins(userId: string): Promise<void> {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: 0,
                lastFailedLoginAt: null,
                lockedUntil: null,
            },
        });
    } catch (err) {
        console.error("[account-lockout] resetFailedLogins failed:", err);
    }
}

export const ACCOUNT_LOCKOUT_CONFIG = {
    MAX_ATTEMPTS,
    MAX_WINDOW_MS,
    LOCKOUT_MS,
};
