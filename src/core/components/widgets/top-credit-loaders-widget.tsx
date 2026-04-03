"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";

interface TopLoader {
    username: string;
    total: number;
}

export function TopCreditLoadersWidget() {
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();
    const [loaders, setLoaders] = useState<TopLoader[]>([]);

    useEffect(() => {
        fetch("/api/v1/store/orders?limit=100")
            .then((res) => res.json())
            .then((data) => {
                const orders = data.orders || [];
                const userTotals: Record<string, { username: string; total: number }> = {};
                for (const order of orders) {
                    const uid = order.user?.username || "Unknown";
                    if (!userTotals[uid]) userTotals[uid] = { username: uid, total: 0 };
                    userTotals[uid].total += Number(order.total);
                }
                const sorted = Object.values(userTotals).sort((a, b) => b.total - a.total).slice(0, 3);
                setLoaders(sorted);
            })
            .catch(() => {});
    }, []);

    if (loaders.length === 0) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{sidebarT('topCreditLoaders')}</h3>
                <span className="text-xs text-gray-500 uppercase">{sidebarT('allTime')}</span>
            </div>
            <div className="space-y-3">
                {loaders.map((loader, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                            {loader.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{loader.username}</p>
                        </div>
                        <span className="text-sm text-gray-600">{formatPrice(loader.total)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
