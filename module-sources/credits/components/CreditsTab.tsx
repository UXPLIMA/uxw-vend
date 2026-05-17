"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Coins, Loader2, ArrowDownLeft, ArrowUpRight, ShoppingBag, Send } from "lucide-react";

interface Transaction {
    id: string;
    amount: string | number;
    type: string;
    description: string | null;
    createdAt: string;
}

const typeIcon = (type: string) => {
    switch (type) {
        case "purchase": return <ShoppingBag className="w-4 h-4 text-blue-500" />;
        case "transfer": return <Send className="w-4 h-4 text-purple-500" />;
        case "debit":
        case "spend": return <ArrowUpRight className="w-4 h-4 text-red-500" />;
        default: return <ArrowDownLeft className="w-4 h-4 text-emerald-500" />;
    }
};

export default function CreditsTab() {
    const t = useTranslations("credits");
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const [balance, setBalance] = useState<number>(0);
    const [history, setHistory] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/credits")
            .then(r => r.json())
            .then(d => {
                setBalance(Number(d.balance || 0));
                setHistory(Array.isArray(d.history) ? d.history : []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const typeLabel = (type: string) => {
        const key = `type${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}`;
        try { return t(key); } catch { return type; }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Coins className="w-4 h-4" /> {t("balance")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    ) : (
                        <p className="text-3xl font-bold">{balance.toFixed(2)}</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t("history")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : history.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">{t("noTransactions")}</p>
                    ) : (
                        <div className="divide-y">
                            {history.map(tx => {
                                const amount = Number(tx.amount);
                                const isNegative = amount < 0;
                                return (
                                    <div key={tx.id} className="flex items-center gap-3 py-3">
                                        <div className="flex-shrink-0">{typeIcon(tx.type)}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{typeLabel(tx.type)}</p>
                                            {tx.description && (
                                                <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-semibold ${isNegative ? "text-red-500" : "text-emerald-500"}`}>
                                                {isNegative ? "" : "+"}{amount.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(tx.createdAt).toLocaleDateString(__dateTag)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
