import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { formatCurrency, formatDate } from "@/core/lib/utils";
import { ArrowLeft } from "lucide-react";
import { OrderStatusSelect } from "./status-select";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
    const session = await auth();
    if (!session?.user) redirect("/auth/login");

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) redirect("/");

    const { id } = await params;

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, username: true, email: true } },
            items: {
                include: {
                    product: { select: { id: true, name: true, slug: true, image: true } },
                },
            },
            payments: true,
        },
    });

    if (!order) notFound();

    const getStatusColor = (status: string) => {
        switch (status) {
            case "COMPLETED": return "bg-green-100 text-green-700";
            case "PENDING": return "bg-yellow-100 text-yellow-700";
            case "PROCESSING": return "bg-blue-100 text-blue-700";
            case "CANCELLED": return "bg-red-100 text-red-700";
            case "REFUNDED": return "bg-gray-100 text-gray-700";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/store/orders">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">Order {order.orderNumber}</h1>
                    <p className="text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Order Items */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Items ({order.items.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                                        <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                                            {item.product?.image ? (
                                                <img src={item.product.image} alt={item.product?.name || "Product"} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{item.product?.name || "Deleted product"}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatCurrency(Number(item.price))} x {item.quantity}
                                            </p>
                                        </div>
                                        <p className="font-medium">
                                            {formatCurrency(Number(item.price) * item.quantity)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-border mt-4 pt-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{formatCurrency(Number(order.subtotal))}</span>
                                </div>
                                {Number(order.discount) > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Discount</span>
                                        <span>-{formatCurrency(Number(order.discount))}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span>{formatCurrency(Number(order.total))}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {order.notes && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">{order.notes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="font-medium">{order.user.username}</p>
                            <p className="text-sm text-muted-foreground">{order.user.email}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Payment</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">
                                <span className="text-muted-foreground">Method: </span>
                                <span className="font-medium">{order.paymentMethod || "N/A"}</span>
                            </p>
                            <p className="text-sm mt-1">
                                <span className="text-muted-foreground">Status: </span>
                                <span className="font-medium">{order.status}</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Created</span>
                                <span>{formatDate(order.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Updated</span>
                                <span>{formatDate(order.updatedAt)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
