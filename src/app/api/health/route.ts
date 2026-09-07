import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { isRedisReady, rateLimitForRoleAsync, getClientIP } from "@/core/lib/rate-limit";
import { isRedisConfigured } from "@/core/lib/redis";
import { getEmailConfig } from "@/core/lib/email-config";
import { bootstrapScheduler, listRegisteredJobs } from "@/core/lib/scheduler";
import pkg from "../../../../package.json";

/**
 * Public health check endpoint for load balancer probes and the
 * admin observability dashboard.
 *
 * Returns a structured snapshot of the platform's critical
 * subsystems. The HTTP status reflects the overall health:
 *   - 200 ok        - every subsystem nominal
 *   - 200 degraded  - DB is fine but a non-critical check failed
 *   - 503 down      - DB is unreachable, the app cannot serve
 *
 * No auth: standard for k8s/ALB probes. Rate limited to 30/min/IP
 * to prevent abuse and accidental amplification.
 */

interface HealthResponse {
    status: "ok" | "degraded" | "down";
    timestamp: string;
    checks: {
        database: { ok: boolean; latencyMs?: number; error?: string };
        redis: { ok: boolean; enabled: boolean; error?: string };
        emailQueue: { ok: boolean; configured: boolean; pending: number; failed: number; error?: string };
        scheduler: { ok: boolean; staleJobs: number; error?: string };
    };
    version: string;
}

// Health is a PUBLIC endpoint (load balancer probes have no auth). Leaking
// raw driver errors reveals DB hostnames, connection strings, and fs paths
// to anyone on the internet. Non-prod envs (staging, preview) are often
// reachable from the internet too, so we only surface raw messages when
// HEALTH_DEBUG=1 is explicitly set. Otherwise we always reply with a
// generic "check failed".
const HEALTH_DEBUG = process.env.HEALTH_DEBUG === "1";
function safeErrorMessage(err: unknown): string | undefined {
    if (!HEALTH_DEBUG) return "check failed";
    if (err instanceof Error) return err.message;
    if (err === undefined || err === null) return undefined;
    return String(err);
}

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, error: safeErrorMessage(err) };
    }
}

async function checkRedis(): Promise<{ ok: boolean; enabled: boolean; error?: string }> {
    if (!isRedisConfigured()) return { ok: true, enabled: false };
    try {
        const ready = await isRedisReady();
        return ready
            ? { ok: true, enabled: true }
            : { ok: false, enabled: true, error: HEALTH_DEBUG ? "Redis ping failed" : "check failed" };
    } catch (err) {
        return { ok: false, enabled: true, error: safeErrorMessage(err) };
    }
}

/**
 * An empty queue is not a working mailer. With no transport configured there
 * is nothing to fail, so `failed < 10` was reporting a green tick on a site
 * that could not send a password reset. Redis says "not configured" in exactly
 * this situation and email now says the same thing, out of the one place that
 * decides whether mail can go out at all.
 */
async function checkEmailQueue(): Promise<{ ok: boolean; configured: boolean; pending: number; failed: number; error?: string }> {
    try {
        const [config, pending, failed] = await Promise.all([
            getEmailConfig(),
            prisma.emailJob.count({ where: { status: "pending" } }),
            prisma.emailJob.count({ where: { status: "failed" } }),
        ]);
        const configured = Boolean(config.apiKey);
        return { ok: configured ? failed < 10 : true, configured, pending, failed };
    } catch (err) {
        return { ok: false, configured: false, pending: 0, failed: 0, error: safeErrorMessage(err) };
    }
}

/** How far past its due time a job may drift before it counts as behind. */
const SCHEDULER_GRACE_MS = 2 * 60 * 1000;

/**
 * Is the scheduler keeping up?
 *
 * This used to count rows that were overdue **and** whose last run had
 * errored, which made the one failure it exists to catch invisible: when the
 * ticker stops, every job falls behind while `lastStatus` stays "ok". Measured
 * against the development database - a job two hours overdue whose last run
 * succeeded, and this endpoint answering `status: ok, staleJobs: 0`.
 *
 * The narrowing was not pointless and is kept, only on the right axis. A
 * module an operator switched off leaves its CronRun row behind with an old
 * `nextRunAt` for ever, so counting every overdue row would put the site in a
 * permanent amber nothing can clear. What is supposed to run is what is
 * registered, so that is what is asked about.
 *
 * A job that failed but is not yet due again is not stale, and is not lost
 * either: it is what /api/v1/admin/observability/recent-errors reads.
 *
 * The registry is loaded first, the way both admin cron routes already do it
 * and for the reason they give: a freshly booted process has registered
 * nothing until it ticks, and reading an empty registry here would have turned
 * this check into a permanent green. `bootstrapScheduler` is idempotent.
 */
async function checkScheduler(): Promise<{ ok: boolean; staleJobs: number; error?: string }> {
    try {
        await bootstrapScheduler();
        const registered = listRegisteredJobs().map((job) => job.key);
        // A build with no jobs at all has nothing to be behind on.
        if (registered.length === 0) return { ok: true, staleJobs: 0 };

        const staleJobs = await prisma.cronRun.count({
            where: {
                jobKey: { in: registered },
                nextRunAt: { lt: new Date(Date.now() - SCHEDULER_GRACE_MS) },
            },
        });
        return { ok: staleJobs === 0, staleJobs };
    } catch (err) {
        return { ok: false, staleJobs: 0, error: safeErrorMessage(err) };
    }
}

export async function GET(req: Request) {
    // Public endpoint - rate limit per IP to prevent abuse.
    const ip = getClientIP(req.headers);
    // 120/min/IP - admin observability polls /api/health every 10s, plus
    // load-balancer probes, plus incidental curl. 30/min was too tight.
    const allowed = await rateLimitForRoleAsync(`health:${ip}`, { maxRequests: 120, windowMs: 60_000 }, null);
    if (!allowed) {
        return NextResponse.json(
            { status: "down", error: "Too Many Requests" },
            { status: 429, headers: { "Cache-Control": "no-store" } },
        );
    }

    const [database, redis, emailQueue, scheduler] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkEmailQueue(),
        checkScheduler(),
    ]);

    let status: HealthResponse["status"];
    if (!database.ok) {
        status = "down";
    } else if (!redis.ok || !emailQueue.ok || !scheduler.ok) {
        status = "degraded";
    } else {
        status = "ok";
    }

    const body: HealthResponse = {
        status,
        timestamp: new Date().toISOString(),
        checks: { database, redis, emailQueue, scheduler },
        version: (pkg as { version: string }).version,
    };

    const httpStatus = status === "down" ? 503 : 200;

    return NextResponse.json(body, {
        status: httpStatus,
        headers: { "Cache-Control": "no-store" },
    });
}
