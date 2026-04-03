"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatRelativeTime } from "@/core/lib/utils";

interface RecentOrder {
    id: string;
    orderNumber: string;
    createdAt: string;
    user: { username: string };
    items: { product: { name: string } }[];
}

export function RecentPurchasesWidget() {
    const sidebarT = useTranslations('sidebar');
    const [orders, setOrders] = useState<RecentOrder[]>([]);

    useEffect(() => {
        fetch("/api/v1/store/orders?limit=4")
            .then((res) => res.json())
            .then((data) => setOrders(data.orders || []))
            .catch(() => {});
    }, []);

    if (orders.length === 0) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{sidebarT('recentPurchases')}</h3>
                <span className="text-xs text-green-600 font-medium">● {sidebarT('live')}</span>
            </div>
            <div className="space-y-3">
                {orders.map((order) => (
                    <div key={order.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                            {order.user.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{order.user.username}</p>
                            <p className="text-xs text-gray-500 truncate">
                                {order.items[0]?.product?.name || "Order"}
                                {order.items.length > 1 && ` +${order.items.length - 1}`}
                            </p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                            {formatRelativeTime(new Date(order.createdAt))}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
