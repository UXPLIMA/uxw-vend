import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

const startTime = Date.now();

export async function GET() {
    let dbStatus = "ok";
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbStatus = "error";
    }

    return NextResponse.json({
        status: dbStatus === "ok" ? "healthy" : "degraded",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        database: dbStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "0.1.0",
    });
}
