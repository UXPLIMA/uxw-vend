import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

/**
 * GET /api/v1/admin/observability/recent-errors
 *
 * Returns the 10 most recent CronRun rows that finished with an
 * error status. Used by the admin observability dashboard to
 * surface stuck or failing scheduled jobs at a glance.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const errors = await prisma.cronRun.findMany({
        where: { lastStatus: "error" },
        orderBy: { lastRunAt: "desc" },
        take: 10,
        select: {
            jobKey: true,
            lastRunAt: true,
            lastError: true,
            lastRunMs: true,
            nextRunAt: true,
        },
    });

    return NextResponse.json({ data: errors });
}
