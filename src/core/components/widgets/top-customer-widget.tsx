
"use client";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";

// Sample data
const topCustomer = { name: "xSteve", avatar: "S", monthlySpend: 2450 };

export function TopCustomerWidget() {
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4">{sidebarT('topCustomer')}</h3>
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 font-bold text-xl">
                    {topCustomer.avatar}
                </div>
                <h4 className="font-semibold text-gray-900">{topCustomer.name}</h4>
                <p className="text-sm text-gray-500">
                    {sidebarT('paidThisMonth', { amount: formatPrice(topCustomer.monthlySpend) })}
                </p>
            </div>
        </div>
    );
}
