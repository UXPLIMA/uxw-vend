import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { formatCurrency } from "@/core/lib/utils";

/**
 * Store stats endpoint.
 *
 * Returns:
 *  - stats: scalar KPIs (products / orders / revenue)
 *  - sections: recent orders panel
 *  - charts: daily time series for the Analytics page
 *      * orders-per-day (COMPLETED only)
 *      * revenue-per-day (COMPLETED only)
 *
 * Accepts ?period=7|30|90|365 to match the analytics date range picker.
 * Defaults to 30 days.
 */
export async function GET(request: NextRequest) {
    const period = Math.min(
        365,
        Math.max(1, parseInt(request.nextUrl.searchParams.get("period") || "30", 10) || 30),
    );

    const [products, orders, revenueData] = await Promise.all([
        prisma.product.count(),
        prisma.order.count(),
        prisma.order.aggregate({ _sum: { total: true }, where: { status: "COMPLETED" } }),
    ]);
    const revenue = Number(revenueData._sum.total || 0);

    const recentOrders = await prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { username: true } } },
    });

    // ─── Time series for Analytics page ───
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    startDate.setHours(0, 0, 0, 0);

    const completedInWindow = await prisma.order.findMany({
        where: { status: "COMPLETED", createdAt: { gte: startDate } },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: "asc" },
    });

    const labels: string[] = [];
    const ordersByDay: Record<string, number> = {};
    const revenueByDay: Record<string, number> = {};
    for (let i = 0; i <= period; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        labels.push(key);
        ordersByDay[key] = 0;
        revenueByDay[key] = 0;
    }
    for (const o of completedInWindow) {
        const key = o.createdAt.toISOString().split("T")[0];
        if (key in ordersByDay) {
            ordersByDay[key] += 1;
            revenueByDay[key] += Number(o.total);
        }
    }

    return NextResponse.json({
        stats: { products, orders, revenue },
        charts: [
            {
                id: "store-orders",
                label: "Orders per day",
                labelKey: "analytics_storeOrdersPerDay",
                labels,
                data: labels.map((k) => ordersByDay[k]),
                color: "#3b82f6",
            },
            {
                id: "store-revenue",
                label: "Revenue per day",
                labelKey: "analytics_storeRevenuePerDay",
                labels,
                data: labels.map((k) => Number(revenueByDay[k].toFixed(2))),
                color: "#10b981",
                format: "currency",
            },
        ],
        sections: [
            {
                id: "recent-orders",
                title: "Recent Orders",
                titleKey: "dashboard_recentOrders",
                viewAllHref: "/admin/store/orders",
                items: recentOrders.map((o) => ({
                    id: o.id,
                    href: "/admin/store/orders/" + o.id,
                    primary: o.orderNumber,
                    secondary: o.user.username + " · " + o.createdAt.toISOString().split("T")[0],
                    badge: o.status,
                    badgeColor: o.status === "COMPLETED" ? "green" : o.status === "PENDING" ? "yellow" : "blue",
                    value: formatCurrency(Number(o.total)),
                })),
            },
        ],
    });
}
