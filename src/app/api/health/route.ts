import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { getRedisClient, isRedisConfigured } from "@/core/lib/redis";
import fs from "fs/promises";

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

    const healthy = Object.values(checks).every((c) => c.status === "ok");

    // Strip sensitive details from unauthenticated response
    // Full details available via /api/v1/admin/system (admin auth required)
    const safeChecks: Record<string, { status: string }> = {};
    for (const [k, v] of Object.entries(checks)) {
        safeChecks[k] = { status: v.status };
    }

    return NextResponse.json(
        { status: healthy ? "healthy" : "degraded", checks: safeChecks, timestamp: new Date().toISOString() },
        { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
}
