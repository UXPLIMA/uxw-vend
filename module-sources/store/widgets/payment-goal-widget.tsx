"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCurrency } from "../lib/currency-context";
import { Target } from "lucide-react";

interface GoalData {
    target: number;
    title: string;
    current: number;
    endDate: string | null;
}

export function PaymentGoalWidget() {
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

    if (!goal || goal.target <= 0) return null;

    const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));

    return (
        <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-foreground">{goal.title || sidebarT('paymentGoal')}</h3>
            </div>

            <div className="h-4 bg-muted rounded-full overflow-hidden mb-2 relative">
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
                <span className="text-muted-foreground">{formatPrice(goal.current)}</span>
                <span className="text-muted-foreground">{formatPrice(goal.target)}</span>
            </div>

            {goal.endDate && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    Ends {new Date(goal.endDate).toLocaleDateString("tr-TR")}
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
