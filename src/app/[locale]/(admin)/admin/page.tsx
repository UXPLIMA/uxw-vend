import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { moduleSystem } from "@/core/lib/modules";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { formatCurrency, formatDate } from "@/core/lib/utils";
import { Users, Package, ShoppingCart, DollarSign, Ticket, FileText, MessageSquare } from "lucide-react";
import { DashboardCharts } from "./components/dashboard-charts";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
    const storeEnabled = moduleSystem.isEnabled('store');
    const blogEnabled = moduleSystem.isEnabled('blog');
    const forumEnabled = moduleSystem.isEnabled('forum');
    const supportEnabled = moduleSystem.isEnabled('support');

    const [
        totalUsers,
        totalProducts,
        totalOrders,
        totalTickets,
        totalArticles,
        totalTopics,
        recentOrders,
        revenueData,
        recentTickets,
        recentTopics,
    ] = await Promise.all([
        prisma.user.count(),
        storeEnabled ? prisma.product.count() : 0,
        storeEnabled ? prisma.order.count() : 0,
        supportEnabled ? prisma.ticket.count() : 0,
        blogEnabled ? prisma.blogArticle.count() : 0,
        forumEnabled ? prisma.forumTopic.count() : 0,
        storeEnabled ? prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { username: true, email: true } },
            },
        }) : [],
        storeEnabled ? prisma.order.aggregate({
            _sum: { total: true },
            where: { status: "COMPLETED" },
        }) : { _sum: { total: null } },
        supportEnabled ? prisma.ticket.findMany({
            take: 5,
            where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY"] } },
            orderBy: { createdAt: "desc" },
            include: { user: { select: { username: true } }, department: { select: { name: true } } },
        }) : [],
        forumEnabled ? prisma.forumTopic.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { author: { select: { username: true } }, category: { select: { name: true } } },
        }) : [],
    ]);

    return {
        totalUsers,
        totalProducts,
        totalOrders,
        totalTickets,
        totalArticles,
        totalTopics,
        recentOrders,
        recentTickets,
        recentTopics,
        totalRevenue: revenueData._sum.total || 0,
        storeEnabled,
        blogEnabled,
        forumEnabled,
        supportEnabled,
    };
}

export default async function AdminDashboard() {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/login");
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        redirect("/");
    }

    const stats = await getDashboardStats();

    const statCards = [
        ...(stats.storeEnabled ? [
            { label: "Revenue", value: formatCurrency(Number(stats.totalRevenue)), icon: DollarSign, href: "/admin/store/orders", color: "text-green-600" },
            { label: "Orders", value: stats.totalOrders, icon: ShoppingCart, href: "/admin/store/orders", color: "text-blue-600" },
            { label: "Products", value: stats.totalProducts, icon: Package, href: "/admin/store/products", color: "text-purple-600" },
        ] : []),
        { label: "Users", value: stats.totalUsers, icon: Users, href: "/admin/users", color: "text-orange-600" },
        ...(stats.supportEnabled ? [
            { label: "Tickets", value: stats.totalTickets, icon: Ticket, href: "/admin/tickets", color: "text-red-600" },
        ] : []),
        ...(stats.blogEnabled ? [
            { label: "Articles", value: stats.totalArticles, icon: FileText, href: "/admin/blog/articles", color: "text-indigo-600" },
        ] : []),
        ...(stats.forumEnabled ? [
            { label: "Topics", value: stats.totalTopics, icon: MessageSquare, href: "/admin/forum/categories", color: "text-teal-600" },
        ] : []),
    ];

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {session.user.name}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map((stat) => (
                    <Link key={stat.label} href={stat.href}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                </div>
                                <div className="text-2xl font-bold">{stat.value}</div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Recent Orders */}
            {stats.storeEnabled && (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Recent Orders</CardTitle>
                        <Link href="/admin/store/orders" className="text-sm text-primary hover:underline">
                            View All
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    {stats.recentOrders.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No orders yet</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.recentOrders.map((order) => (
                                <Link
                                    key={order.id}
                                    href={`/admin/store/orders/${order.id}`}
                                    className="flex justify-between items-center p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                >
                                    <div>
                                        <p className="font-medium">{order.orderNumber}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {order.user.username} · {formatDate(order.createdAt)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatCurrency(Number(order.total))}</p>
                                        <span
                                            className={`text-xs px-2 py-1 rounded ${order.status === "COMPLETED"
                                                ? "bg-green-100 text-green-700"
                                                : order.status === "PENDING"
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : order.status === "PROCESSING"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : "bg-gray-100 text-gray-500"
                                                }`}
                                        >
                                            {order.status}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            )}

            {/* Recent Tickets & Topics */}
            {(stats.supportEnabled || stats.forumEnabled) && (
            <div className="grid lg:grid-cols-2 gap-6 mt-6">
                {stats.supportEnabled && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base">Open Tickets</CardTitle>
                            <Link href="/admin/tickets" className="text-xs text-primary hover:underline">View All</Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {stats.recentTickets.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4 text-sm">No open tickets</p>
                        ) : (
                            <div className="space-y-2">
                                {stats.recentTickets.map((t: any) => (
                                    <Link key={t.id} href={`/admin/tickets/${t.id}`} className="flex justify-between items-center p-2 rounded hover:bg-muted/50 text-sm">
                                        <div>
                                            <p className="font-medium truncate max-w-[200px]">{t.subject}</p>
                                            <p className="text-xs text-muted-foreground">{t.user.username} · {t.department.name}</p>
                                        </div>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t.status}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                )}

                {stats.forumEnabled && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base">Latest Forum Topics</CardTitle>
                            <Link href="/admin/forum/topics" className="text-xs text-primary hover:underline">View All</Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {stats.recentTopics.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4 text-sm">No topics yet</p>
                        ) : (
                            <div className="space-y-2">
                                {stats.recentTopics.map((t: any) => (
                                    <div key={t.id} className="flex justify-between items-center p-2 text-sm">
                                        <div>
                                            <p className="font-medium truncate max-w-[200px]">{t.title}</p>
                                            <p className="text-xs text-muted-foreground">{t.author.username} · {t.category.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                )}
            </div>
            )}

            {/* Charts */}
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Analytics</h2>
                <DashboardCharts />
            </div>
        </>
    );
}
