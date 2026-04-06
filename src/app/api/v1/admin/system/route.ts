import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import os from "os";
import fs from "fs/promises";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Database stats
    const [
        totalUsers,
        newUsersWeek,
        totalModules,
        enabledModules,
        dbSizeResult,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
        prisma.moduleConfig.count(),
        prisma.moduleConfig.count({ where: { enabled: true } }),
        prisma.$queryRaw<[{ size: string }]>`SELECT pg_size_pretty(pg_database_size(current_database())) as size`,
    ]);

    // Disk usage
    let diskInfo = { total: "N/A", used: "N/A", free: "N/A" };
    try {
        const stats = await fs.statfs("/");
        const total = stats.bsize * stats.blocks;
        const free = stats.bsize * stats.bfree;
        const used = total - free;
        const fmt = (b: number) => `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
        diskInfo = { total: fmt(total), used: fmt(used), free: fmt(free) };
    } catch { /* statfs not supported on all platforms */ }

    // System info
    const mem = process.memoryUsage();
    const system = {
        nodeVersion: process.version,
        platform: `${os.platform()} ${os.arch()}`,
        hostname: os.hostname(),
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || "N/A",
        loadAvg: os.loadavg().map((l) => Math.round(l * 100) / 100),
        totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
        freeMemoryGB: (os.freemem() / 1024 / 1024 / 1024).toFixed(1),
        processMemoryMB: {
            rss: Math.round(mem.rss / 1024 / 1024),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
        uptimeHours: Math.round(os.uptime() / 3600 * 10) / 10,
    };

    return NextResponse.json({
        database: {
            size: dbSizeResult[0]?.size || "N/A",
            totalUsers,
            newUsersWeek,
            totalModules,
            enabledModules,
        },
        disk: diskInfo,
        system,
        timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
}
