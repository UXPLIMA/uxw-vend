import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { getRedisClient, isRedisConfigured } from "@/core/lib/redis";
import fs from "fs/promises";
import os from "os";

const startTime = Date.now();

export async function GET() {
    const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; detail?: string }> = {};

    // Database check
    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
    } catch (err) {
        checks.database = { status: "error", latencyMs: Date.now() - dbStart, detail: (err as Error).message };
    }

    // Redis check (uses shared client)
    if (isRedisConfigured()) {
        const redisStart = Date.now();
        try {
            const client = await getRedisClient();
            if (client) {
                await client.ping();
                checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
            } else {
                checks.redis = { status: "error", latencyMs: Date.now() - redisStart, detail: "Connection failed" };
            }
        } catch (err) {
            checks.redis = { status: "error", latencyMs: Date.now() - redisStart, detail: (err as Error).message };
        }
    }

    // Disk check
    try {
        const tmpFile = `/tmp/.healthcheck-${Date.now()}`;
        await fs.writeFile(tmpFile, "ok");
        await fs.unlink(tmpFile);
        checks.disk = { status: "ok" };
    } catch {
        checks.disk = { status: "error", detail: "Cannot write to /tmp" };
    }

    // System info
    const mem = process.memoryUsage();
    const system = {
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        nodeVersion: process.version,
        platform: os.platform(),
        memoryMB: {
            rss: Math.round(mem.rss / 1024 / 1024),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
        cpuCount: os.cpus().length,
        loadAvg: os.loadavg().map((l) => Math.round(l * 100) / 100),
    };

    const healthy = Object.values(checks).every((c) => c.status === "ok");

    return NextResponse.json(
        { status: healthy ? "healthy" : "degraded", checks, system, timestamp: new Date().toISOString() },
        { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
}
