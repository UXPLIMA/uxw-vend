"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/core/lib/currency/context";
import { Target } from "lucide-react";
import { useModuleEnabled } from "@/core/hooks/useModule";

interface GoalData {
    target: number;
    title: string;
    current: number;
    endDate: string | null;
}

export function PaymentGoalWidget() {
    const { enabled: storeEnabled } = useModuleEnabled('store');
    const sidebarT = useTranslations('sidebar');
    const { formatPrice } = useCurrency();
    const [goal, setGoal] = useState<GoalData | null>(null);

    useEffect(() => {
        // Fetch goal settings and current revenue
        Promise.all([
            fetch("/api/v1/community-goal").then((r) => r.ok ? r.json() : null),
        ]).then(([goalData]) => {
            if (goalData) setGoal(goalData);
        }).catch(() => {});
    }, []);

    if (!storeEnabled) return null;
    if (!goal || goal.target <= 0) return null;

    const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-gray-900">{goal.title || sidebarT('paymentGoal')}</h3>
            </div>

            <div className="h-4 bg-gray-200 rounded-full overflow-hidden mb-2 relative">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 rounded-full"
                    style={{ width: `${percent}%` }}
                />
                {percent > 10 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                        {percent}%
                    </span>
                )}
            </div>

            <div className="flex justify-between text-sm">
                <span className="text-gray-600">{formatPrice(goal.current)}</span>
                <span className="text-gray-400">{formatPrice(goal.target)}</span>
            </div>

            {goal.endDate && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                    Ends {new Date(goal.endDate).toLocaleDateString()}
                </p>
            )}

            {percent >= 100 && (
                <div className="mt-2 text-center text-xs font-bold text-green-600 bg-green-50 rounded py-1">
                    Goal Reached!
                </div>
            )}
        </div>
    );
}
