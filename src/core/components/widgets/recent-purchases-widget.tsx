
"use client";

import { useTranslations } from "next-intl";

// Sample data
const recentPurchases = [
    { user: "xSteve", product: "VIP Rank", date: "2 min", avatar: "S", price: 19.99 },
    { user: "GamerPro", product: "100 Credits", date: "5 min", avatar: "G", price: 9.99 },
    { user: "BlockKing", product: "Premium Key", date: "12 min", avatar: "B", price: 4.99 },
    { user: "MineMaster", product: "MVP+ Rank", date: "18 min", avatar: "M", price: 29.99 },
];

export function RecentPurchasesWidget() {
    const sidebarT = useTranslations('sidebar');

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{sidebarT('recentPurchases')}</h3>
                <span className="text-xs text-green-600 font-medium">● {sidebarT('live')}</span>
            </div>
            <div className="space-y-3">
                {recentPurchases.map((purchase, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                            {purchase.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{purchase.user}</p>
                            <p className="text-xs text-gray-500 truncate">{purchase.product}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{purchase.date}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
