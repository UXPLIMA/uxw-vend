import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { isRedisReady, rateLimitForRoleAsync, getClientIP } from "@/core/lib/rate-limit";
import { isRedisConfigured } from "@/core/lib/redis";
import pkg from "../../../../package.json";

/**
 * Public health check endpoint for load balancer probes and the
 * admin observability dashboard.
 *
 * Returns a structured snapshot of the platform's critical
 * subsystems. The HTTP status reflects the overall health:
 *   - 200 ok        — every subsystem nominal
 *   - 200 degraded  — DB is fine but a non-critical check failed
 *   - 503 down      — DB is unreachable, the app cannot serve
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
        emailQueue: { ok: boolean; pending: number; failed: number; error?: string };
        scheduler: { ok: boolean; staleJobs: number; error?: string };
    };
    version: string;
}

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
}

async function checkRedis(): Promise<{ ok: boolean; enabled: boolean; error?: string }> {
    if (!isRedisConfigured()) return { ok: true, enabled: false };
    try {
        const ready = await isRedisReady();
        return ready
            ? { ok: true, enabled: true }
            : { ok: false, enabled: true, error: "Redis ping failed" };
    } catch (err) {
        return { ok: false, enabled: true, error: (err as Error).message };
    }
}

async function checkEmailQueue(): Promise<{ ok: boolean; pending: number; failed: number; error?: string }> {
    try {
        const [pending, failed] = await Promise.all([
            prisma.emailJob.count({ where: { status: "pending" } }),
            prisma.emailJob.count({ where: { status: "failed" } }),
        ]);
        return { ok: failed < 10, pending, failed };
    } catch (err) {
        return { ok: false, pending: 0, failed: 0, error: (err as Error).message };
    }
}

async function checkScheduler(): Promise<{ ok: boolean; staleJobs: number; error?: string }> {
    try {
        const cutoff = new Date(Date.now() - 2 * 60 * 1000);
        const staleJobs = await prisma.cronRun.count({
            where: {
                nextRunAt: { lt: cutoff },
                lastStatus: "error",
            },
        });
        return { ok: staleJobs === 0, staleJobs };
    } catch (err) {
        return { ok: false, staleJobs: 0, error: (err as Error).message };
    }
}

export async function GET(req: Request) {
    // Public endpoint — rate limit per IP to prevent abuse.
    const ip = getClientIP(req.headers);
    const allowed = await rateLimitForRoleAsync(`health:${ip}`, { maxRequests: 30, windowMs: 60_000 }, null);
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
