"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "../lib/currency-context";

interface TopBuyer {
    username: string;
    avatar: string | null;
    total: number;
}

export function TopBuyersWidget() {
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();
    const [buyers, setBuyers] = useState<TopBuyer[]>([]);

    useEffect(() => {
        fetch("/api/v1/widget-stats")
            .then((res) => res.json())
            .then((data) => setBuyers(data.topBuyers || []))
            .catch(() => {});
    }, []);

    if (buyers.length === 0) return null;

    return (
        <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">{sidebarT('topBuyers')}</h3>
                <span className="text-xs text-muted-foreground uppercase">{sidebarT('thisWeek')}</span>
            </div>
            <div className="space-y-3">
                {buyers.map((buyer, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm overflow-hidden">
                            {buyer.avatar ? (
                                <>{/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={buyer.avatar} alt="" className="w-full h-full object-cover" /></>
                            ) : (
                                buyer.username[0].toUpperCase()
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-foreground text-sm">{buyer.username}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatPrice(buyer.total)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
