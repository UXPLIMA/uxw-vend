"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Link } from "@/core/lib/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { ShoppingCart, ChevronDown, ChevronUp, Package } from "lucide-react";
import { formatCurrency, formatDate } from "@/core/lib/utils";

interface Order {
    id: string;
    orderNumber: string;
    subtotal: number;
    discount: number;
    total: number;
    status: string;
    createdAt: string;
    items: {
        id: string;
        name: string;
        price: number;
        quantity: number;
        product: { id: string; name: string; image: string | null } | null;
    }[];
}

const statusColor = (status: string) => {
    switch (status) {
        case "COMPLETED": return "bg-green-100 text-green-700";
        case "PENDING": return "bg-yellow-100 text-yellow-700";
        case "PROCESSING": return "bg-blue-100 text-blue-700";
        case "CANCELLED": return "bg-red-100 text-red-700";
        default: return "bg-muted text-foreground";
    }
};

export function ProfileOrdersTab() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/v1/store/orders?limit=10")
            .then(r => r.ok ? r.json() : { orders: [] })
            .then(data => setOrders(data.orders || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <div className="w-6 h-6 border-2 border-border border-t-gray-600 rounded-full animate-spin mx-auto" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Order History</CardTitle>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <div className="text-center py-8">
                        <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-muted-foreground">No orders yet</p>
                        <Link href="/store">
                            <Button variant="outline" className="mt-3">Browse Store</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map((order) => (
                            <div key={order.id}>
                                <button
                                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                >
                                    <div className="text-left">
                                        <p className="font-medium">{order.orderNumber}</p>
                                        <p className="text-xs text-muted-foreground">{formatDate(new Date(order.createdAt))}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="font-bold">{formatCurrency(Number(order.total))}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded ${statusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        {expandedOrder === order.id
                                            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        }
                                    </div>
                                </button>
                                {expandedOrder === order.id && order.items && (
                                    <div className="mt-1 p-4 bg-background border rounded-lg">
                                        <div className="space-y-2">
                                            {order.items.map((item) => (
                                                <div key={item.id} className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-muted rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                        {item.product?.image ? (
                                                            <Image src={item.product.image} alt="" width={40} height={40} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Package className="w-4 h-4 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{item.product?.name || item.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatCurrency(Number(item.price))} × {item.quantity}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-medium">
                                                        {formatCurrency(Number(item.price) * item.quantity)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                        {Number(order.discount) > 0 && (
                                            <div className="flex justify-between mt-3 pt-3 border-t text-sm text-green-600">
                                                <span>Discount</span>
                                                <span>-{formatCurrency(Number(order.discount))}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between mt-2 pt-2 border-t text-sm font-bold">
                                            <span>Total</span>
                                            <span>{formatCurrency(Number(order.total))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default ProfileOrdersTab;
