import prisma from "@/core/lib/db";

/**
 * Setup state tracking.
 *
 * A fresh install has zero users. When the first admin is created via the
 * setup wizard, we flip `setupComplete` to `true` permanently (for the life
 * of this process). Middleware and API routes check this to decide whether
 * to gate incoming requests behind the wizard.
 *
 * On DB errors we fail-safe (return true) so that a broken database never
 * locks an installed site into an un-escapable setup screen.
 */

let setupComplete = false;
let lastCheck = 0;
const CHECK_INTERVAL_MS = 10_000;

export async function isSetupComplete(): Promise<boolean> {
    if (setupComplete) return true;

    const now = Date.now();
    if (now - lastCheck < CHECK_INTERVAL_MS) {
        // Throttled — assume not yet complete until the next scheduled poll.
        return false;
    }
    lastCheck = now;

    try {
        const count = await prisma.user.count();
        if (count > 0) {
            setupComplete = true;
            return true;
        }
        return false;
    } catch {
        // Fail-safe: if the database is unreachable, don't trap visitors in
        // the setup wizard. Treat as complete.
        return true;
    }
}

export function markSetupComplete(): void {
    setupComplete = true;
    lastCheck = Date.now();
}

/**
 * Test / internal helper: force a re-check on next call.
 * Not called from normal app flow.
 */
export function resetSetupStateForTesting(): void {
    setupComplete = false;
    lastCheck = 0;
}
