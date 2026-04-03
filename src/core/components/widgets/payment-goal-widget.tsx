"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";

export function PaymentGoalWidget() {
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();
    const [current, setCurrent] = useState(0);
    const [target] = useState(5000); // TODO: fetch from settings API when available

    useEffect(() => {
        // Calculate current from completed orders this month
        fetch("/api/v1/store/orders?limit=100")
            .then((res) => res.json())
            .then((data) => {
                const orders = data.orders || [];
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const monthTotal = orders
                    .filter((o: { status: string; createdAt: string }) =>
                        o.status === "COMPLETED" && new Date(o.createdAt) >= monthStart
                    )
                    .reduce((sum: number, o: { total: number }) => sum + Number(o.total), 0);
                setCurrent(monthTotal);
            })
            .catch(() => {});
    }, []);

    const goalPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4">{sidebarT('paymentGoal')}</h3>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${goalPercent}%` }}
                />
            </div>
            <p className="text-center text-sm text-gray-600">
                {formatPrice(current)} / {formatPrice(target)} ({goalPercent}%)
            </p>
        </div>
    );
}
