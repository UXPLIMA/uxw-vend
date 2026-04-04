import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/stats?period=30d
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const period = request.nextUrl.searchParams.get("period") || "30d";
    const days = parseInt(period) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetch orders in period (fails silently if order model unavailable)
    let orders: { total: any; status: string; createdAt: Date }[] = [];
    try {
        orders = await prisma.order.findMany({
            where: { createdAt: { gte: startDate } },
            select: { total: true, status: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });
    } catch { /* order model unavailable */ }

    // Fetch users in period
    const users = await prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
    });

    // Group by day
    const revenueByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};
    const usersByDay: Record<string, number> = {};

    // Initialize all days
    for (let i = 0; i <= days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        revenueByDay[key] = 0;
        ordersByDay[key] = 0;
        usersByDay[key] = 0;
    }

    for (const order of orders) {
        const key = order.createdAt.toISOString().split("T")[0];
        ordersByDay[key] = (ordersByDay[key] || 0) + 1;
        if (order.status === "COMPLETED") {
            revenueByDay[key] = (revenueByDay[key] || 0) + Number(order.total);
        }
    }

    for (const user of users) {
        const key = user.createdAt.toISOString().split("T")[0];
        usersByDay[key] = (usersByDay[key] || 0) + 1;
    }

    const labels = Object.keys(revenueByDay);

    return NextResponse.json({
        labels,
        revenue: Object.values(revenueByDay),
        orders: Object.values(ordersByDay),
        users: Object.values(usersByDay),
        totals: {
            revenue: Object.values(revenueByDay).reduce((a, b) => a + b, 0),
            orders: orders.length,
            users: users.length,
        },
    });
}
