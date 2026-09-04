import { prisma } from "@/core/lib/db";

/**
 * Audit-log retention.
 *
 * Tables like ActivityFeedItem, CronRun and Revision grow unbounded unless
 * pruned. `pruneOldRecords()` deletes rows older than the per-table retention
 * window. Called daily by the core scheduler.
 *
 * Core's tables only. `WebhookLog` used to be pruned here too, guarded by an
 * `in prisma` check because it belongs to the `webhook-logs` module - and that
 * module has always run its own daily cron over the same table with the same
 * thirty day window, so core was doing a module's work twice a day while
 * naming a model it has no business knowing.
 *
 * Retention windows (days):
 *   ActivityFeedItem   180
 *   CronRun             30
 *   Revision           365  (longer - it's a compliance/audit trail)
 *   UserSession         30  (past expiresAt OR revoked)
 *   VerificationToken   already expired
 *
 * Returns a summary of how many rows each table dropped so the cron log
 * is useful for ops.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PruneResult {
    activityFeed: number;
    cronRun: number;
    revision: number;
    userSession: number;
    verificationToken: number;
}

export async function pruneOldRecords(): Promise<PruneResult> {
    const result: PruneResult = { activityFeed: 0, cronRun: 0, revision: 0, userSession: 0, verificationToken: 0 };

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

    // Email verification and password reset both live in VerificationToken,
    // and both leave a row behind whenever the person never finishes: an
    // unconfirmed signup, a reset link nobody clicked. Nothing consumes an
    // expired one, so past `expires` there is only growth. This prune sat in
    // `runScheduledTasks()`, which no scheduled job ever called, so the rows
    // had accumulated since the table existed.
    try {
        const r = await prisma.verificationToken.deleteMany({
            where: { expires: { lt: now } },
        });
        result.verificationToken = r.count;
    } catch (err) {
        console.error("[retention] verificationToken prune failed:", err);
    }

    return result;
}
