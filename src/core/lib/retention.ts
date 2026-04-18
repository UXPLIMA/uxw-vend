import { prisma } from "@/core/lib/db";

/**
 * Audit-log retention.
 *
 * Tables like ActivityFeedItem, WebhookLog, CronRun, and Revision grow
 * unbounded unless pruned. `pruneOldRecords()` deletes rows older than the
 * per-table retention window. Called daily by the core scheduler.
 *
 * Retention windows (days):
 *   ActivityFeedItem   180
 *   WebhookLog          30
 *   CronRun             30
 *   Revision           365  (longer — it's a compliance/audit trail)
 *   UserSession         30  (past expiresAt OR revoked)
 *
 * Returns a summary of how many rows each table dropped so the cron log
 * is useful for ops.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PruneResult {
    activityFeed: number;
    webhookLog: number;
    cronRun: number;
    revision: number;
    userSession: number;
}

export async function pruneOldRecords(): Promise<PruneResult> {
    const result: PruneResult = { activityFeed: 0, webhookLog: 0, cronRun: 0, revision: 0, userSession: 0 };

    const cutoff = (days: number) => new Date(Date.now() - days * DAY_MS);
    const now = new Date();

    try {
        const r = await prisma.activityFeedItem.deleteMany({
            where: { createdAt: { lt: cutoff(180) } },
        });
        result.activityFeed = r.count;
    } catch (err) {
        console.error("[retention] activityFeed prune failed:", err);
    }

    // WebhookLog may not exist in all installs (it's owned by the webhook-logs
    // module). Guard accordingly.
    try {
        if ("webhookLog" in prisma) {
            const r = await (prisma as unknown as { webhookLog: { deleteMany: (args: unknown) => Promise<{ count: number }> } })
                .webhookLog.deleteMany({ where: { createdAt: { lt: cutoff(30) } } });
            result.webhookLog = r.count;
        }
    } catch (err) {
        console.error("[retention] webhookLog prune failed:", err);
    }

    try {
        const r = await prisma.cronRun.deleteMany({
            where: { lastRunAt: { lt: cutoff(30) } },
        });
        result.cronRun = r.count;
    } catch (err) {
        console.error("[retention] cronRun prune failed:", err);
    }

    try {
        const r = await prisma.revision.deleteMany({
            where: { createdAt: { lt: cutoff(365) } },
        });
        result.revision = r.count;
    } catch (err) {
        console.error("[retention] revision prune failed:", err);
    }

    // UserSession: drop anything that's already expired, plus revoked rows
    // older than the retention window. Keeping recent revoked sessions lets
    // admins audit "why did you sign me out on device X" for a while.
    try {
        const r = await prisma.userSession.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: now } },
                    { isRevoked: true, createdAt: { lt: cutoff(30) } },
                ],
            },
        });
        result.userSession = r.count;
    } catch (err) {
        console.error("[retention] userSession prune failed:", err);
    }

    return result;
}
