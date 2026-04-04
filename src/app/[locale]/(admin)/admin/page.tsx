import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import moduleSystem from "@/core/lib/modules";
import { ModuleDashboardCards } from "@/core/generated/module-registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { formatCurrency, formatDate } from "@/core/lib/utils";
import { Users, Package, ShoppingCart, DollarSign, Ticket, FileText, MessageSquare, Trophy, Vote, Dices, History, Download, Megaphone } from "lucide-react";
import { DashboardCharts } from "./components/dashboard-charts";

export const dynamic = "force-dynamic";

const iconMap: Record<string, any> = {
    Users, Package, ShoppingCart, DollarSign, Ticket, FileText, MessageSquare,
    Trophy, Vote, Dices, History, Download, Megaphone,
};

// Stats fetchers per module — each module provides its own stats
const statFetchers: Record<string, () => Promise<Record<string, any>>> = {
    store: async () => {
        const [products, orders, revenue] = await Promise.all([
            prisma.product.count(),
            prisma.order.count(),
            prisma.order.aggregate({ _sum: { total: true }, where: { status: "COMPLETED" } }),
        ]);
        const recentOrders = await prisma.order.findMany({
            take: 5, orderBy: { createdAt: "desc" },
            include: { user: { select: { username: true } } },
        });
        return { products, orders, revenue: revenue._sum.total || 0, recentOrders };
    },
    blog: async () => {
        const articles = await prisma.blogArticle.count();
        return { articles };
    },
    forum: async () => {
        const topics = await prisma.forumTopic.count();
        const recentTopics = await prisma.forumTopic.findMany({
            take: 5, orderBy: { createdAt: "desc" },
            include: { author: { select: { username: true } }, category: { select: { name: true } } },
        });
        return { topics, recentTopics };
    },
    support: async () => {
        const tickets = await prisma.ticket.count();
        const openTickets = await prisma.ticket.findMany({
            take: 5,
            where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY"] } },
            orderBy: { createdAt: "desc" },
            include: { user: { select: { username: true } }, department: { select: { name: true } } },
        });
        return { tickets, openTickets };
    },
};

export default async function AdminDashboard() {
    const session = await auth();
    if (!session?.user) redirect("/auth/login");
    if (!(await isAdmin(session.user.id))) redirect("/");

    // Initialize module system
    const dbModuleConfigs = await prisma.moduleConfig.findMany();
    await moduleSystem.initialize(
        dbModuleConfigs.map((mc) => ({ id: mc.id, enabled: mc.enabled, config: mc.config as Record<string, unknown> }))
    );

    // Core stats (always available)
    const totalUsers = await prisma.user.count();

    // Fetch stats only for enabled modules
    const moduleStats: Record<string, any> = {};
    for (const [moduleId, fetcher] of Object.entries(statFetchers)) {
        if (moduleSystem.isEnabled(moduleId)) {
            moduleStats[moduleId] = await fetcher();
        }
    }

    // Flatten stats for dashboard card lookup
    const allStats: Record<string, any> = { users: totalUsers };
    for (const stats of Object.values(moduleStats)) {
        Object.assign(allStats, stats);
    }

    // Build stat cards from registry (only enabled modules)
    const enabledCards = ModuleDashboardCards.filter(c => moduleSystem.isEnabled(c.module));

    // Always show Users card
    const userCard = { label: "Users", value: totalUsers, icon: Users, href: "/admin/users", color: "text-orange-600" };

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {session.user.name}</p>
            </div>

            {/* Stats Grid — driven by module manifests */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {enabledCards.map((card) => {
                    const Icon = iconMap[card.icon] || Package;
                    const value = card.statKey === "revenue"
                        ? formatCurrency(Number(allStats[card.statKey] || 0))
                        : allStats[card.statKey] || 0;
                    return (
                        <Link key={card.id} href={card.href}>
                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
                                        <Icon className={`w-4 h-4 ${card.color}`} />
                                    </div>
                                    <div className="text-2xl font-bold">{value}</div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
                <Link href="/admin/users">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Users</span>
                                <Users className="w-4 h-4 text-orange-600" />
                            </div>
                            <div className="text-2xl font-bold">{totalUsers}</div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Module-provided sections */}
            <div className="space-y-6">
                {/* Store: Recent Orders */}
                {moduleStats.store?.recentOrders?.length > 0 && (
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Recent Orders</CardTitle>
                                <Link href="/admin/store/orders" className="text-sm text-primary hover:underline">View All</Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {moduleStats.store.recentOrders.map((order: any) => (
                                    <Link key={order.id} href={`/admin/store/orders/${order.id}`}
                                        className="flex justify-between items-center p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                        <div>
                                            <p className="font-medium">{order.orderNumber}</p>
                                            <p className="text-sm text-muted-foreground">{order.user.username} · {formatDate(order.createdAt)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{formatCurrency(Number(order.total))}</p>
                                            <span className={`text-xs px-2 py-1 rounded ${
                                                order.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                                                order.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                                                order.status === "PROCESSING" ? "bg-blue-100 text-blue-700" :
                                                "bg-gray-100 text-gray-500"
                                            }`}>{order.status}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Support + Forum grid */}
                {(moduleStats.support || moduleStats.forum) && (
                    <div className="grid lg:grid-cols-2 gap-6">
                        {moduleStats.support?.openTickets?.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-base">Open Tickets</CardTitle>
                                        <Link href="/admin/tickets" className="text-xs text-primary hover:underline">View All</Link>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {moduleStats.support.openTickets.map((t: any) => (
                                            <Link key={t.id} href={`/admin/tickets/${t.id}`} className="flex justify-between items-center p-2 rounded hover:bg-muted/50 text-sm">
                                                <div>
                                                    <p className="font-medium truncate max-w-[200px]">{t.subject}</p>
                                                    <p className="text-xs text-muted-foreground">{t.user.username} · {t.department?.name}</p>
                                                </div>
                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t.status}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {moduleStats.forum?.recentTopics?.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-base">Latest Forum Topics</CardTitle>
                                        <Link href="/admin/forum/topics" className="text-xs text-primary hover:underline">View All</Link>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {moduleStats.forum.recentTopics.map((t: any) => (
                                            <div key={t.id} className="flex justify-between items-center p-2 text-sm">
                                                <div>
                                                    <p className="font-medium truncate max-w-[200px]">{t.title}</p>
                                                    <p className="text-xs text-muted-foreground">{t.author.username} · {t.category.name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>

            {/* Charts */}
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Analytics</h2>
                <DashboardCharts />
            </div>
        </>
    );
}
