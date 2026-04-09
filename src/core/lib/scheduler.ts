import { prisma } from "@/core/lib/db";

/**
 * Lightweight cron-style scheduler.
 *
 * Runs in-process via setInterval, ticks every minute. On each tick:
 *   1. Reads CronRun rows for all known job keys
 *   2. Determines which jobs are due based on their schedule
 *   3. Executes each due job inside a try/catch
 *   4. Updates CronRun with the result
 *
 * Schedule keywords:
 *   every-minute      → 1 min
 *   every-5-minutes   → 5 min
 *   every-15-minutes  → 15 min
 *   every-hour        → 60 min
 *   every-day         → 24 h
 *   every-week        → 7 d
 *   every-month       → 30 d
 *
 * Jobs are registered by:
 *   - Core (built-in: revision pruning, etc.) — registered in this file
 *   - Modules — picked up from manifest.cronJobs at server bootstrap
 *
 * Multi-process safety: not strictly safe across PM2 cluster mode. The
 * `lastRunAt` row provides eventual single-execution but two workers can
 * race within the same minute. Acceptable for this app's scale; future
 * upgrade can use Redis SET NX for distributed locking.
 */

export type CronHandler = () => Promise<void>;

interface CronJob {
    key: string;          // "<moduleId>:<jobId>" or "core:<jobId>"
    schedule: string;
    handler: CronHandler;
}

const SCHEDULE_MS: Record<string, number> = {
    "every-minute": 60_000,
    "every-5-minutes": 5 * 60_000,
    "every-15-minutes": 15 * 60_000,
    "every-hour": 60 * 60_000,
    "every-day": 24 * 60 * 60_000,
    "every-week": 7 * 24 * 60 * 60_000,
    "every-month": 30 * 24 * 60 * 60_000,
};

const registeredJobs = new Map<string, CronJob>();
let tickerStarted = false;

export function registerCronJob(job: CronJob): void {
    if (!SCHEDULE_MS[job.schedule]) {
        console.warn(`[scheduler] Unknown schedule "${job.schedule}" for ${job.key}`);
        return;
    }
    registeredJobs.set(job.key, job);
}

async function isDue(key: string, schedule: string): Promise<boolean> {
    const intervalMs = SCHEDULE_MS[schedule];
    if (!intervalMs) return false;

    const run = await prisma.cronRun.findUnique({ where: { jobKey: key } });
    if (!run) return true; // Never run
    return Date.now() - run.lastRunAt.getTime() >= intervalMs;
}

async function runJob(job: CronJob): Promise<void> {
    const start = Date.now();
    let status: "ok" | "error" = "ok";
    let error: string | null = null;
    try {
        await job.handler();
    } catch (err) {
        status = "error";
        error = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] Job ${job.key} failed:`, err);
    }
    const lastRunMs = Date.now() - start;
    const lastRunAt = new Date();
    const intervalMs = SCHEDULE_MS[job.schedule];
    const nextRunAt = intervalMs ? new Date(lastRunAt.getTime() + intervalMs) : null;

    try {
        await prisma.cronRun.upsert({
            where: { jobKey: job.key },
            create: { jobKey: job.key, lastRunAt, lastStatus: status, lastError: error, lastRunMs, nextRunAt },
            update: { lastRunAt, lastStatus: status, lastError: error, lastRunMs, nextRunAt },
        });
    } catch (err) {
        console.error(`[scheduler] Failed to record run for ${job.key}:`, err);
    }
}

async function tick(): Promise<void> {
    for (const job of registeredJobs.values()) {
        try {
            if (await isDue(job.key, job.schedule)) {
                await runJob(job);
            }
        } catch (err) {
            console.error(`[scheduler] Tick error for ${job.key}:`, err);
        }
    }
}

/**
 * Bootstrap: registers core jobs, loads module jobs, starts the ticker.
 * Idempotent.
 */
export async function bootstrapScheduler(): Promise<void> {
    if (tickerStarted) return;
    tickerStarted = true;

    // ─── Core built-in jobs ───
    registerCronJob({
        key: "core:prune-revisions",
        schedule: "every-day",
        handler: async () => {
            const { pruneOldRevisions } = await import("./revisions");
            const count = await pruneOldRevisions(90);
            console.log(`[cron] prune-revisions: removed ${count} entries`);
        },
    });

    registerCronJob({
        key: "core:expire-warnings",
        schedule: "every-hour",
        handler: async () => {
            const result = await prisma.userWarning.updateMany({
                where: { isActive: true, expiresAt: { lt: new Date() } },
                data: { isActive: false },
            });
            if (result.count > 0) console.log(`[cron] expire-warnings: ${result.count}`);
        },
    });

    registerCronJob({
        key: "core:process-broadcasts",
        schedule: "every-minute",
        handler: async () => {
            const { processQueuedBroadcasts } = await import("./broadcasts");
            await processQueuedBroadcasts();
        },
    });

    registerCronJob({
        key: "core:process-email-queue",
        schedule: "every-5-minutes",
        handler: async () => {
            const { processEmailQueue } = await import("./email");
            const result = await processEmailQueue();
            if (result.sent > 0 || result.failed > 0) {
                console.log(`[cron] email-queue: sent=${result.sent} failed=${result.failed}`);
            }
        },
    });

    registerCronJob({
        key: "core:retention-prune",
        schedule: "every-day",
        handler: async () => {
            const { pruneOldRecords } = await import("./retention");
            const r = await pruneOldRecords();
            const total = r.activityFeed + r.webhookLog + r.cronRun + r.revision;
            if (total > 0) {
                console.log(`[cron] retention: activityFeed=${r.activityFeed} webhookLog=${r.webhookLog} cronRun=${r.cronRun} revision=${r.revision}`);
            }
        },
    });

    registerCronJob({
        key: "core:health-alerting",
        schedule: "every-5-minutes",
        handler: async () => {
            const { checkAndAlert } = await import("./health-alerting");
            const result = await checkAndAlert();
            if (result.notified) {
                console.log(`[cron] health-alerting: notified status=${result.status}`);
            }
        },
    });

    registerCronJob({
        key: "core:prune-ip-blocks",
        schedule: "every-hour",
        handler: async () => {
            const { invalidateIpBlockCache } = await import("./ip-blocks");
            // Hard-delete blocks that expired > 7 days ago so the
            // table doesn't accumulate stale rows forever. Expired
            // blocks are already filtered at query time, but pruning
            // keeps the list tidy.
            const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const result = await prisma.ipBlock.deleteMany({
                where: { expiresAt: { lt: cutoff, not: null } },
            });
            invalidateIpBlockCache();
            if (result.count > 0) {
                console.log(`[cron] prune-ip-blocks: removed ${result.count} expired entries`);
            }
        },
    });

    registerCronJob({
        key: "core:automated-backup",
        schedule: "every-day",
        handler: async () => {
            const { createBackup } = await import("./backup");
            try {
                const meta = await createBackup("scheduled", "Daily automated backup");
                console.log(`[cron] automated-backup: created ${meta.filename} (${meta.sizeBytes} bytes)`);
            } catch (err) {
                console.error("[cron] automated-backup failed:", err);
            }
        },
    });

    registerCronJob({
        key: "core:publish-scheduled",
        schedule: "every-5-minutes",
        handler: async () => {
            const now = new Date();
            // Each model is owned by a module; absent models are silently skipped.
            // We cast through unknown so scheduler.ts stays compilable regardless
            // of which modules are installed at merge time.
            const prismaAny = prisma as unknown as {
                blogArticle?: {
                    updateMany: (args: unknown) => Promise<{ count: number }>;
                };
                changelogEntry?: {
                    updateMany: (args: unknown) => Promise<{ count: number }>;
                };
                announcement?: {
                    updateMany: (args: unknown) => Promise<{ count: number }>;
                };
            };

            const runBlog = async (): Promise<number> => {
                if (!prismaAny.blogArticle) return 0;
                try {
                    const r = await prismaAny.blogArticle.updateMany({
                        where: { publishAt: { lte: now }, status: "SCHEDULED" },
                        data: { status: "PUBLISHED", publishAt: null, publishedAt: now },
                    });
                    return r.count;
                } catch {
                    return 0;
                }
            };

            const runChangelog = async (): Promise<number> => {
                if (!prismaAny.changelogEntry) return 0;
                try {
                    const r = await prismaAny.changelogEntry.updateMany({
                        where: { publishAt: { lte: now } },
                        data: { publishAt: null },
                    });
                    return r.count;
                } catch {
                    return 0;
                }
            };

            const runAnnouncements = async (): Promise<number> => {
                if (!prismaAny.announcement) return 0;
                try {
                    const r = await prismaAny.announcement.updateMany({
                        where: { publishAt: { lte: now } },
                        data: { publishAt: null },
                    });
                    return r.count;
                } catch {
                    return 0;
                }
            };

            const [blogCount, changelogCount, announcementCount] = await Promise.all([
                runBlog(),
                runChangelog(),
                runAnnouncements(),
            ]);

            if (blogCount || changelogCount || announcementCount) {
                console.log(
                    `[cron] publish-scheduled: blog=${blogCount} changelog=${changelogCount} announcements=${announcementCount}`
                );
            }
        },
    });

    // ─── Module-contributed jobs ───
    try {
        const { ModuleCronJobs } = await import("@/core/generated/module-crons");
        for (const entry of ModuleCronJobs) {
            try {
                const mod = await entry.loader();
                const handler = mod.default;
                if (typeof handler !== "function") {
                    console.warn(`[scheduler] ${entry.module}/${entry.id}: no default async function exported`);
                    continue;
                }
                registerCronJob({
                    key: `${entry.module}:${entry.id}`,
                    schedule: entry.schedule,
                    handler: handler as CronHandler,
                });
            } catch (err) {
                console.error(`[scheduler] Failed to load ${entry.module}/${entry.id}:`, err);
            }
        }
    } catch {
        // module-crons.ts may not exist on first build — silently continue
    }

    console.log(`[scheduler] Registered ${registeredJobs.size} cron jobs, ticking every minute`);

    // First tick after a short delay so the server settles
    setTimeout(() => { void tick(); }, 5_000);
    // Recurring tick
    setInterval(() => { void tick(); }, 60_000);
}

export function listScheduledJobs(): { key: string; schedule: string }[] {
    return Array.from(registeredJobs.values()).map((j) => ({ key: j.key, schedule: j.schedule }));
}

/**
 * List all currently registered jobs (key + schedule). Used by the admin
 * cron page to show every job, even ones that have never executed yet.
 */
export function listRegisteredJobs(): { key: string; schedule: string }[] {
    return Array.from(registeredJobs.values()).map((j) => ({ key: j.key, schedule: j.schedule }));
}

/**
 * Manually invoke a registered job by key. Updates CronRun like a normal
 * scheduled execution. Throws if no job is registered with that key.
 */
export async function runJobNow(key: string): Promise<void> {
    const job = registeredJobs.get(key);
    if (!job) {
        throw new Error(`No registered cron job with key "${key}"`);
    }
    await runJob(job);
}
