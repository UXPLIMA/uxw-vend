import { NextRequest, NextResponse } from "next/server";
import { formatCurrency } from "@/core/sdk";
import { dailySeries, dayLabels, isAdmin, prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

/**
 * Store stats endpoint.
 *
 * Returns:
 *  - stats: scalar KPIs (products / orders / revenue)
 *  - sections: recent orders panel
 *  - charts: daily time series for the Analytics page
 *      * orders-per-day (COMPLETED only, drawn as bars - a count of orders
 *        on a day is a discrete comparison, not a curve through the days)
 *      * revenue-per-day (COMPLETED only, drawn as a filled trend)
 *  - rankings: top products by revenue in the window. A leaderboard has no
 *    time axis, so core gives it its own panel rather than a chart.
 *
 * Accepts ?period=7|30|90|365 to match the analytics date range picker.
 * Defaults to 30 days.
 */
/**
 * The dashboard and analytics screens are the only callers, and both are
 * behind the admin panel. Without this the endpoint answered anyone: an
 * anonymous request read the numbers straight out of the database.
 */
async function requireAdmin(): Promise<NextResponse | null> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return null;
}

export async function GET(request: NextRequest) {
    const denied = await requireAdmin();
    if (denied) return denied;

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

    // Grouped by the database, counts and revenue in one pass. This used to
    // read every completed order in the window - up to a year of them - to
    // produce one number per day.
    const series = await dailySeries({
        table: "Order",
        since: startDate,
        sumColumn: "total",
        equals: { status: "COMPLETED" },
    });

    const labels = dayLabels(startDate, period);
    const ordersByDay: Record<string, number> = Object.fromEntries(labels.map((k) => [k, 0]));
    const revenueByDay: Record<string, number> = Object.fromEntries(labels.map((k) => [k, 0]));
    for (const row of series) {
        if (!(row.day in ordersByDay)) continue;
        ordersByDay[row.day] = row.count;
        revenueByDay[row.day] = row.sum;
    }

    // Top sellers in the window. Grouped in the database; the product names
    // are fetched in one follow-up query rather than one per row.
    const topRows = await prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { price: true, quantity: true },
        where: {
            productId: { not: null },
            order: { status: "COMPLETED", createdAt: { gte: startDate } },
        },
        orderBy: { _sum: { price: "desc" } },
        take: 8,
    });
    const topProducts = await prisma.product.findMany({
        where: { id: { in: topRows.map((r) => r.productId!).filter(Boolean) } },
        select: { id: true, name: true, slug: true },
    });
    const productById = new Map(topProducts.map((p) => [p.id, p]));

    return NextResponse.json({
        stats: { products, orders, revenue },
        rankings: [
            {
                id: "store-top-products",
                label: "Top products by revenue",
                labelKey: "analytics_storeTopProducts",
                color: "#10b981",
                format: "currency",
                items: topRows.map((row) => {
                    const product = productById.get(row.productId!);
                    return {
                        id: row.productId!,
                        label: product?.name ?? row.productId!,
                        value: Number(row._sum.price || 0),
                        secondary: `${row._sum.quantity ?? 0}x`,
                        href: product ? `/admin/store/products/${product.id}/edit` : undefined,
                    };
                }),
            },
        ],
        charts: [
            {
                id: "store-orders",
                label: "Orders per day",
                labelKey: "analytics_storeOrdersPerDay",
                labels,
                data: labels.map((k) => ordersByDay[k]),
                color: "#3b82f6",
                type: "bar",
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
                    secondary: (o.user?.username ?? "Deleted user") + " · " + o.createdAt.toISOString().split("T")[0],
                    badge: o.status,
                    badgeColor: o.status === "COMPLETED" ? "green" : o.status === "PENDING" ? "yellow" : "blue",
                    value: formatCurrency(Number(o.total)),
                })),
            },
        ],
    });
}
