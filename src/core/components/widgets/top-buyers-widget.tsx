
"use client";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";

// Sample data
const topBuyers = [
    { name: "xSteve", avatar: "S", amount: 245 },
    { name: "ProGamer123", avatar: "P", amount: 198 },
    { name: "MineCraft_King", avatar: "M", amount: 156 },
];

export function TopBuyersWidget() {
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{sidebarT('topBuyers')}</h3>
                <span className="text-xs text-gray-500 uppercase">{sidebarT('thisWeek')}</span>
            </div>
            <div className="space-y-3">
                {topBuyers.map((buyer, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                            {buyer.avatar}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{buyer.name}</p>
                        </div>
                        <span className="text-sm text-gray-600">{formatPrice(buyer.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
