import { prisma } from "@/core/lib/db";
import { errorText, log } from "./logger";

/**
 * Audit-log retention.
 *
 * Tables like ActivityFeedItem and Revision grow unbounded unless pruned.
 * `pruneOldRecords()` deletes rows older than the per-table retention window.
 * Called daily by the core scheduler.
 *
 * `CronRun` used to be swept here on the same premise and does not belong:
 * `jobKey` is its primary key and `claimJob` upserts on it, so it holds one
 * row per registered job and cannot grow past the number of jobs. What the
 * thirty day window actually reached was the row of a job that had not run in
 * that time, which is one whose module is switched off or one that runs
 * monthly, and deleting it took `lastStatus` and `lastError` with it. Those
 * are what the observability screen reads, so a job that failed and then
 * stopped running had its failure swept away by the daily tidy-up.
 *
 * Core's tables only. `WebhookLog` used to be pruned here too, guarded by an
 * `in prisma` check because it belongs to the `webhook-logs` module - and that
 * module has always run its own daily cron over the same table with the same
 * thirty day window, so core was doing a module's work twice a day while
 * naming a model it has no business knowing.
 *
 * Retention windows (days):
 *   ActivityFeedItem   180
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
    revision: number;
    userSession: number;
    verificationToken: number;
}

export async function pruneOldRecords(): Promise<PruneResult> {
    const result: PruneResult = { activityFeed: 0, revision: 0, userSession: 0, verificationToken: 0 };

    const cutoff = (days: number) => new Date(Date.now() - days * DAY_MS);
    const now = new Date();

    try {
        const r = await prisma.activityFeedItem.deleteMany({
            where: { createdAt: { lt: cutoff(180) } },
        });
        result.activityFeed = r.count;
    } catch (err) {
        log.error("[retention] activityFeed prune failed", { error: errorText(err) });
    }

    try {
        const r = await prisma.revision.deleteMany({
            where: { createdAt: { lt: cutoff(365) } },
        });
        result.revision = r.count;
    } catch (err) {
        log.error("[retention] revision prune failed", { error: errorText(err) });
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
        log.error("[retention] userSession prune failed", { error: errorText(err) });
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
        log.error("[retention] verificationToken prune failed", { error: errorText(err) });
    }

    return result;
}
