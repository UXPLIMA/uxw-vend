import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

// GET /api/v1/store/widget-stats - Public stats for homepage widgets
export async function GET() {
    try {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const recentOrders = await prisma.order.findMany({
            where: { status: "COMPLETED" },
            select: {
                userId: true,
                total: true,
                createdAt: true,
                user: { select: { username: true, avatar: true } },
                items: { select: { product: { select: { name: true, image: true } } } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });

        // Recent purchases (last 4)
        const recentPurchases = recentOrders.slice(0, 4).map((o) => ({
            username: o.user.username,
            avatar: o.user.avatar,
            product: o.items[0]?.product?.name || "Unknown",
            productImage: o.items[0]?.product?.image || null,
            time: o.createdAt,
        }));

        // Top customer (highest total spend)
        const customerSpend: Record<string, { username: string; avatar: string | null; total: number }> = {};
        for (const o of recentOrders) {
            const key = o.userId;
            if (!customerSpend[key]) {
                customerSpend[key] = { username: o.user.username, avatar: o.user.avatar, total: 0 };
            }
            customerSpend[key].total += Number(o.total);
        }
        const topCustomer = Object.values(customerSpend).sort((a, b) => b.total - a.total)[0] || null;

        // Top buyers this week
        const weeklyOrders = recentOrders.filter((o) => o.createdAt >= weekAgo);
        const weeklySpend: Record<string, { username: string; avatar: string | null; total: number }> = {};
        for (const o of weeklyOrders) {
            const key = o.userId;
            if (!weeklySpend[key]) {
                weeklySpend[key] = { username: o.user.username, avatar: o.user.avatar, total: 0 };
            }
            weeklySpend[key].total += Number(o.total);
        }
        const topBuyers = Object.values(weeklySpend).sort((a, b) => b.total - a.total).slice(0, 5);

        // Top credit loaders (all time)
        const topCreditLoaders = Object.values(customerSpend).sort((a, b) => b.total - a.total).slice(0, 5);

        return NextResponse.json({
            recentPurchases,
            topCustomer,
            topBuyers,
            topCreditLoaders,
        }, {
            headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
        });
    } catch {
        return NextResponse.json({
            recentPurchases: [],
            topCustomer: null,
            topBuyers: [],
            topCreditLoaders: [],
        });
    }
}
