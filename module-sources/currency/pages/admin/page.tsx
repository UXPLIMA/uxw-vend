"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { Loader2, Plus, Trash2, Save, Star, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface Currency {
    code: string;
    name: string;
    symbol: string;
    rate: number;
    enabled: boolean;
}

interface CurrencyConfig {
    base: string;
    currencies: Currency[];
}

export default function CurrencyAdminPage() {
    const t = useTranslations("currency");
    const { confirm } = useConfirm();
    const [config, setConfig] = useState<CurrencyConfig>({ base: "USD", currencies: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/v1/currency")
            .then((r) => r.json())
            .then((d) => setConfig(d))
            .catch(() => toast.error(t("saveError")))
            .finally(() => setLoading(false));
    }, [t]);

    const updateCurrency = (idx: number, patch: Partial<Currency>) => {
        const next = [...config.currencies];
        next[idx] = { ...next[idx], ...patch };
        setConfig({ ...config, currencies: next });
    };

    const addCurrency = () => {
        setConfig({
            ...config,
            currencies: [
                ...config.currencies,
                { code: "", name: "", symbol: "", rate: 1, enabled: true },
            ],
        });
    };

    const removeCurrency = async (idx: number) => {
        const cur = config.currencies[idx];
        const ok = await confirm({
            title: t("removeCurrency"),
            message: `${cur.code || ""} ${cur.name || ""}`,
            variant: "danger",
        });
        if (!ok) return;
        const next = config.currencies.filter((_, i) => i !== idx);
        setConfig({ ...config, currencies: next });
    };

    const setBase = (code: string) => {
        if (!code) return;
        setConfig({ ...config, base: code });
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/currency", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || t("saveError"));
                return;
            }
            toast.success(t("saved"));
        } catch {
            toast.error(t("saveError"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <DollarSign className="w-7 h-7" />
                        {t("title")}
                    </h1>
                    <p className="text-muted-foreground">{t("settings")}</p>
                </div>
                <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {t("settings")}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("exchangeRates")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {config.currencies.length === 0 && (
                        <p className="text-muted-foreground text-sm">{t("noCurrencies")}</p>
                    )}
                    {config.currencies.map((cur, idx) => {
                        const isBase = cur.code === config.base;
                        return (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-md border border-border bg-muted/30">
                                <div className="col-span-2">
                                    <Label>{t("currencyCode")}</Label>
                                    <Input
                                        value={cur.code}
                                        onChange={(e) => updateCurrency(idx, { code: e.target.value.toUpperCase() })}
                                        placeholder="USD"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Label>{t("currencyName")}</Label>
                                    <Input
                                        value={cur.name}
                                        onChange={(e) => updateCurrency(idx, { name: e.target.value })}
                                        placeholder="US Dollar"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>{t("symbol")}</Label>
                                    <Input
                                        value={cur.symbol}
                                        onChange={(e) => updateCurrency(idx, { symbol: e.target.value })}
                                        placeholder="$"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>{t("exchangeRate")}</Label>
                                    <Input
                                        type="number"
                                        step="0.0001"
                                        value={cur.rate}
                                        onChange={(e) => updateCurrency(idx, { rate: Number(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="col-span-2 flex items-center gap-2">
                                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={cur.enabled}
                                            onChange={(e) => updateCurrency(idx, { enabled: e.target.checked })}
                                        />
                                        {t("enabled")}
                                    </label>
                                </div>
                                <div className="col-span-1 flex items-center justify-end gap-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={isBase ? "default" : "ghost"}
                                        onClick={() => setBase(cur.code)}
                                        title={t("baseCurrency")}
                                    >
                                        <Star className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive"
                                        onClick={() => removeCurrency(idx)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                    <Button type="button" variant="outline" onClick={addCurrency}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t("addCurrency")}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
