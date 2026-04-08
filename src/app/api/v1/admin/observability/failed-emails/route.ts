import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

/**
 * GET /api/v1/admin/observability/failed-emails
 *
 * Returns the 10 most recent EmailJob rows whose status is
 * "failed", newest first. Drives the failed-emails card on the
 * admin observability dashboard so operators can spot delivery
 * issues without paging through the queue.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const emails = await prisma.emailJob.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
            id: true,
            to: true,
            subject: true,
            attempts: true,
            lastError: true,
            createdAt: true,
        },
    });

    return NextResponse.json({ data: emails });
}
