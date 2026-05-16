import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import moduleSystem from "@/core/lib/modules";

// GET /api/v1/store/widget-stats - Public stats for homepage widgets
export async function GET() {
    try {
        // Check if store module is enabled
        const configs = await prisma.moduleConfig.findMany({ select: { id: true, enabled: true, config: true } });
        await moduleSystem.initialize(configs.map(c => ({ id: c.id, enabled: c.enabled, config: c.config as Record<string, unknown> })));
        if (!moduleSystem.isEnabled("store")) {
            return NextResponse.json({
                recentPurchases: [],
                topCustomer: null,
                topBuyers: [],
                topCreditLoaders: [],
            });
        }

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const rawOrders = await prisma.order.findMany({
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

        // Drop orders whose user was deleted (SetNull cascade). Widgets
        // surface usernames/avatars, so anonymous rows have nothing to show.
        const recentOrders = rawOrders.filter(
            (o): o is typeof o & { userId: string; user: NonNullable<typeof o.user> } =>
                o.userId !== null && o.user !== null,
        );

        const recentPurchases = recentOrders.slice(0, 4).map((o) => ({
            username: o.user.username,
            avatar: o.user.avatar,
            product: o.items[0]?.product?.name || "Unknown",
            productImage: o.items[0]?.product?.image || null,
            time: o.createdAt,
        }));

        const customerSpend: Record<string, { username: string; avatar: string | null; total: number }> = {};
        for (const o of recentOrders) {
            const key = o.userId;
            if (!customerSpend[key]) {
                customerSpend[key] = { username: o.user.username, avatar: o.user.avatar, total: 0 };
            }
            customerSpend[key].total += Number(o.total);
        }
        const topCustomer = Object.values(customerSpend).sort((a, b) => b.total - a.total)[0] || null;

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
