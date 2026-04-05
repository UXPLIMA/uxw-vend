import { prisma } from "./db";

/**
 * Scheduled tasks - call from a cron job or admin API
 * Example: curl -X POST http://localhost:3000/api/v1/admin/cron -H "x-api-key: YOUR_KEY"
 *
 * Module-specific tasks (coupon expiry, ticket auto-close, order cancellation, gift code expiry)
 * have been moved to their respective modules. This function remains as a hook point
 * for future core-level scheduled tasks.
 */

export async function runScheduledTasks() {
    const results: string[] = [];

    // Cleanup expired verification tokens
    try {
        const deleted = await prisma.verificationToken.deleteMany({ where: { expires: { lt: new Date() } } });
        if (deleted.count > 0) {
            results.push(`Cleaned up ${deleted.count} expired verification token(s)`);
        }
    } catch { /* table might not exist */ }

    return results;
}
