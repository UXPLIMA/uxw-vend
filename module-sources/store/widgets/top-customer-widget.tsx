"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSiteCurrency } from "@/core/sdk/ui";

export function TopCustomerWidget() {
    const sidebarT = useTranslations('sidebar');
    const { format: formatPrice } = useSiteCurrency();
    const [topCustomer, setTopCustomer] = useState<{ username: string; avatar: string | null; total: number } | null>(null);

    useEffect(() => {
        fetch("/api/v1/widget-stats")
            .then((res) => res.json())
            .then((data) => {
                if (data.topCustomer) setTopCustomer(data.topCustomer);
            })
            .catch(() => {});
    }, []);

    if (!topCustomer) return null;

    return (
        <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-4">{sidebarT('topCustomer')}</h2>
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-muted rounded-lg flex items-center justify-center text-muted-foreground font-bold text-xl overflow-hidden">
                    {topCustomer.avatar ? (
                        <>{/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={topCustomer.avatar} alt="" className="w-full h-full object-cover" /></>
                    ) : (
                        topCustomer.username[0].toUpperCase()
                    )}
                </div>
                <h3 className="font-semibold text-foreground">{topCustomer.username}</h3>
                <p className="text-sm text-muted-foreground">
                    {sidebarT('paidThisMonth', { amount: formatPrice(topCustomer.total) })}
                </p>
            </div>
        </div>
    );
}
