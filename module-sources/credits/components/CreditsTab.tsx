"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, LoadFailed } from "@/core/sdk/ui";
import { Coins, Loader2, ArrowDownLeft, ArrowUpRight, ShoppingBag, Send } from "lucide-react";
import { dateLocaleTag } from "@/core/sdk";
import { creditTypeKey } from "../lib/ledger-types";
import { CreditPackages } from "./CreditPackages";
import { SendCredits } from "./SendCredits";

interface Transaction {
    id: string;
    amount: string | number;
    type: string;
    description: string | null;
    createdAt: string;
}

const typeIcon = (type: string) => {
    switch (type) {
        case "purchase": return <ShoppingBag className="w-4 h-4 text-primary" />;
        case "transfer": return <Send className="w-4 h-4 text-accent" />;
        case "debit":
        case "spend": return <ArrowUpRight className="w-4 h-4 text-destructive" />;
        default: return <ArrowDownLeft className="w-4 h-4 text-success" />;
    }
};

export default function CreditsTab() {
    const t = useTranslations("credits");
    const __locale = useLocale();
    const __dateTag = dateLocaleTag(__locale);
    const [balance, setBalance] = useState<number>(0);
    const [history, setHistory] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/credits")
            .then(r => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then(d => { if (cancelled) return;
                setBalance(Number(d.balance || 0));
                setHistory(Array.isArray(d.history) ? d.history : []);
                setFailed(false);
            })
            .catch(() => { if (cancelled) return; setFailed(true); })
            .finally(() => { if (cancelled) return; setLoading(false); });
        return () => { cancelled = true; };
    }, [reloadKey]);

    // The rule lives beside the catalogue it has to agree with; a gate holds
    // the two together, because a missing key here renders as the key itself.
    const typeLabel = (type: string) => t(creditTypeKey(type));

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

            <CreditPackages onBought={() => setReloadKey((k) => k + 1)} />

            <SendCredits balance={balance} onSent={() => setReloadKey((k) => k + 1)} />

            <Card>
                <CardHeader>
                    <CardTitle>{t("history")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : failed ? (
                        <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
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
                                            <p className={`text-sm font-semibold ${isNegative ? "text-destructive" : "text-success"}`}>
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
