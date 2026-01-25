import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { formatCurrency, formatDate } from "@/core/lib/utils";


export const dynamic = "force-dynamic";


async function getOrders(page: number = 1, limit: number = 20) {
    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            include: {
                user: { select: { id: true, username: true, email: true } },
                items: { select: { id: true } },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma.order.count(),
    ]);

    return { orders, total, pages: Math.ceil(total / limit) };
}

export default async function AdminOrdersPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/login");
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        redirect("/");
    }

    const { orders, total } = await getOrders();

    const getStatusColor = (status: string) => {
        switch (status) {
            case "COMPLETED": return "bg-success/20 text-success";
            case "PENDING": return "bg-warning/20 text-warning";
            case "PROCESSING": return "bg-primary/20 text-primary";
            case "CANCELLED": return "bg-destructive/20 text-destructive";
            case "REFUNDED": return "bg-muted text-muted-foreground";
            default: return "bg-muted text-muted-foreground";
        }
    };

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Orders</h1>
                    <p className="text-muted-foreground">{total} orders total</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    {orders.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="text-4xl mb-4 block">🛒</span>
                            <p className="text-muted-foreground">No orders yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Order</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Items</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => (
                                        <tr key={order.id} className="hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                <p className="font-medium">{order.orderNumber}</p>
                                            </td>
                                            <td className="py-3 px-4">
                                                <p>{order.user.username}</p>
                                                <p className="text-xs text-muted-foreground">{order.user.email}</p>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {formatDate(order.createdAt)}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {order.items.length} items
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                {formatCurrency(Number(order.total))}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Button variant="ghost" size="sm">View</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
