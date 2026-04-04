import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/stats?period=30d — Core stats (Users only, module stats come from module statsApi)
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const period = request.nextUrl.searchParams.get("period") || "30d";
    const days = parseInt(period) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Only core data — users
    const users = await prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
    });

    // Group by day
    const usersByDay: Record<string, number> = {};
    for (let i = 0; i <= days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        usersByDay[d.toISOString().split("T")[0]] = 0;
    }
    for (const user of users) {
        const key = user.createdAt.toISOString().split("T")[0];
        usersByDay[key] = (usersByDay[key] || 0) + 1;
    }

    const labels = Object.keys(usersByDay);

    return NextResponse.json({
        labels,
        users: Object.values(usersByDay),
        totals: { users: users.length },
    });
}
