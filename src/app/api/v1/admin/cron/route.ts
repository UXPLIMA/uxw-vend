import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { runScheduledTasks } from "@/core/lib/scheduled-tasks";

// POST /api/v1/admin/cron - Run scheduled tasks
export async function POST(request: NextRequest) {
    // Allow via API key or admin session
    const apiKey = request.headers.get("x-api-key");
    if (apiKey) {
        const key = await prisma.apiKey.findUnique({ where: { key: apiKey } });
        if (!key || !key.isActive) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
        await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    } else {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = await runScheduledTasks();
    return NextResponse.json({ results, ran: results.length });
}
