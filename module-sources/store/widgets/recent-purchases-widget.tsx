"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRelativeTime } from "@/core/hooks/useRelativeTime";

interface RecentPurchase {
    username: string;
    avatar: string | null;
    product: string;
    time: string;
}

export function RecentPurchasesWidget() {
    const sidebarT = useTranslations('sidebar');
    const relativeTime = useRelativeTime();
    const [purchases, setPurchases] = useState<RecentPurchase[]>([]);

    useEffect(() => {
        fetch("/api/v1/widget-stats")
            .then((res) => res.json())
            .then((data) => setPurchases(data.recentPurchases || []))
            .catch(() => {});
    }, []);

    if (purchases.length === 0) return null;

    return (
        <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">{sidebarT('recentPurchases')}</h3>
                <span className="text-xs text-green-600 font-medium">● {sidebarT('live')}</span>
            </div>
            <div className="space-y-3">
                {purchases.map((purchase, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-medium text-sm overflow-hidden">
                            {purchase.avatar ? (
                                <>{/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={purchase.avatar} alt="" className="w-full h-full object-cover" /></>
                            ) : (
                                purchase.username[0].toUpperCase()
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{purchase.username}</p>
                            <p className="text-xs text-muted-foreground truncate">{purchase.product}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {relativeTime(new Date(purchase.time))}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
