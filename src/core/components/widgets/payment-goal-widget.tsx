
"use client";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";

// Sample data
const paymentGoal = { current: 2850, target: 5000 };

export function PaymentGoalWidget() {
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();
    const goalPercent = paymentGoal.target > 0 ? Math.round((paymentGoal.current / paymentGoal.target) * 100) : 0;

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
                {formatPrice(paymentGoal.current)} / {formatPrice(paymentGoal.target)} ({goalPercent}%)
            </p>
        </div>
    );
}
