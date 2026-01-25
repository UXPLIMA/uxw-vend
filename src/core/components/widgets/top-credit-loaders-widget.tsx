
"use client";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";

// Sample data
const topCreditLoaders = [
    { name: "DiamondHunter", avatar: "D", amount: 500 },
    { name: "BlockMaster", avatar: "B", amount: 425 },
    { name: "another site", avatar: "C", amount: 380 },
];

export function TopCreditLoadersWidget() {
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{sidebarT('topCreditLoaders')}</h3>
                <span className="text-xs text-gray-500 uppercase">{sidebarT('allTime')}</span>
            </div>
            <div className="space-y-3">
                {topCreditLoaders.map((loader, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                            {loader.avatar}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{loader.name}</p>
                        </div>
                        <span className="text-sm text-gray-600">{formatPrice(loader.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
