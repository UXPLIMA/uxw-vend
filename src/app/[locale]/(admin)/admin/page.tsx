import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { formatCurrency } from "@/core/lib/utils";
import { AdminSidebar } from "@/core/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";


async function getDashboardStats() {
    const [
        totalUsers,
        totalProducts,
        totalOrders,
        recentOrders,
        revenueData,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { username: true, email: true } },
            },
        }),
        prisma.order.aggregate({
            _sum: { total: true },
            where: { status: "COMPLETED" },
        }),
    ]);

    return {
        totalUsers,
        totalProducts,
        totalOrders,
        recentOrders,
        totalRevenue: revenueData._sum.total || 0,
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

    return (
        <div className="min-h-screen bg-background">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {session.user.name}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Revenue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">
                            {formatCurrency(Number(stats.totalRevenue))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Orders
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalOrders}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Products
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalProducts}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Users
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalUsers}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Orders */}
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
                        <div className="space-y-4">
                            {stats.recentOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex justify-between items-center p-4 rounded-lg bg-muted/50"
                                >
                                    <div>
                                        <p className="font-medium">{order.orderNumber}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {order.user.username} • {order.user.email}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatCurrency(Number(order.total))}</p>
                                        <span
                                            className={`text-xs px-2 py-1 rounded ${order.status === "COMPLETED"
                                                ? "bg-success/20 text-success"
                                                : order.status === "PENDING"
                                                    ? "bg-warning/20 text-warning"
                                                    : "bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            {order.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
