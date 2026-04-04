"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";
import { useModuleEnabled } from "@/core/hooks/useModule";

interface TopBuyer {
    username: string;
    avatar: string | null;
    total: number;
}

export function TopBuyersWidget() {
    const { enabled: storeEnabled } = useModuleEnabled('store');
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();
    const [buyers, setBuyers] = useState<TopBuyer[]>([]);

    useEffect(() => {
        fetch("/api/v1/widget-stats")
            .then((res) => res.json())
            .then((data) => setBuyers(data.topBuyers || []))
            .catch(() => {});
    }, []);

    if (!storeEnabled) return null;
    if (buyers.length === 0) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{sidebarT('topBuyers')}</h3>
                <span className="text-xs text-gray-500 uppercase">{sidebarT('thisWeek')}</span>
            </div>
            <div className="space-y-3">
                {buyers.map((buyer, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm overflow-hidden">
                            {buyer.avatar ? (
                                <img src={buyer.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                buyer.username[0].toUpperCase()
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{buyer.username}</p>
                        </div>
                        <span className="text-sm text-gray-600">{formatPrice(buyer.total)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
