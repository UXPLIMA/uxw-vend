import { prisma } from "@/core/sdk/server";

/**
 * Declarative hook listener - wired by module.json hookListeners.
 *
 * This module adds three columns to `User`: `twoFactorSecret`,
 * `twoFactorEnabled` and `backupCodes`. Core's erasure anonymises the row
 * and purges whole tables, and it cannot know about a column a module
 * injected into one of its own models, so the TOTP seed and the hashed
 * backup codes of an erased account stayed in the database indefinitely.
 *
 * Login is already closed to a deleted account (`isDeleted` is checked on
 * every request), so this is not a way back in. It is the secret itself
 * that should not outlive the account it belonged to.
 */
export default async function onUserDeleted(payload: { userId: string }) {
    try {
        await prisma.user.update({
            where: { id: payload.userId },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
                backupCodes: null,
            } as Record<string, unknown>,
        });
    } catch (err) {
        // The account is already anonymised; a failure here must not be
        // reported as a failed erasure.
        console.error("[two-factor-auth] Failed to clear 2FA on erasure:", err);
    }
}
