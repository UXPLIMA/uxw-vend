"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "../lib/currency-context";

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
        <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">{sidebarT('topCreditLoaders')}</h3>
                <span className="text-xs text-muted-foreground uppercase">{sidebarT('allTime')}</span>
            </div>
            <div className="space-y-3">
                {loaders.map((loader, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm overflow-hidden">
                            {loader.avatar ? (
                                <>{/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={loader.avatar} alt="" className="w-full h-full object-cover" /></>
                            ) : (
                                loader.username[0].toUpperCase()
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-foreground text-sm">{loader.username}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatPrice(loader.total)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
