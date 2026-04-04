"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";

interface TopLoader {
    username: string;
    avatar: string | null;
    total: number;
}

export function TopCreditLoadersWidget() {
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();
    const [loaders, setLoaders] = useState<TopLoader[]>([]);

    useEffect(() => {
        fetch("/api/v1/widget-stats")
            .then((res) => res.json())
            .then((data) => setLoaders(data.topCreditLoaders || []))
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
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm overflow-hidden">
                            {loader.avatar ? (
                                <img src={loader.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                loader.username[0].toUpperCase()
                            )}
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
