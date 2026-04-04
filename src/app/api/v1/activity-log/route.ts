import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { PER_PAGE_ACTIVITY } from "@/core/lib/constants";

// GET /api/v1/activity-log - Admin only
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || String(PER_PAGE_ACTIVITY));
    const action = request.nextUrl.searchParams.get("action");

    const where = action ? { action } : {};

    const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
            where,
            include: { user: { select: { id: true, username: true } } },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, pages: Math.ceil(total / limit) });
}
