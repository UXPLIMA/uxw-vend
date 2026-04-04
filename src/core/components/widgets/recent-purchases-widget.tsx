"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatRelativeTime } from "@/core/lib/utils";
import { useModuleEnabled } from "@/core/hooks/useModule";

interface RecentPurchase {
    username: string;
    avatar: string | null;
    product: string;
    time: string;
}

export function RecentPurchasesWidget() {
    const { enabled: storeEnabled } = useModuleEnabled('store');
    const sidebarT = useTranslations('sidebar');
    const [purchases, setPurchases] = useState<RecentPurchase[]>([]);

    useEffect(() => {
        fetch("/api/v1/widget-stats")
            .then((res) => res.json())
            .then((data) => setPurchases(data.recentPurchases || []))
            .catch(() => {});
    }, []);

    if (!storeEnabled) return null;
    if (purchases.length === 0) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{sidebarT('recentPurchases')}</h3>
                <span className="text-xs text-green-600 font-medium">● {sidebarT('live')}</span>
            </div>
            <div className="space-y-3">
                {purchases.map((purchase, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm overflow-hidden">
                            {purchase.avatar ? (
                                <img src={purchase.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                purchase.username[0].toUpperCase()
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{purchase.username}</p>
                            <p className="text-xs text-gray-500 truncate">{purchase.product}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                            {formatRelativeTime(new Date(purchase.time))}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
