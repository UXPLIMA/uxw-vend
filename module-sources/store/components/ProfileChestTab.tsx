"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";

interface ChestItem {
    id: string;
    productName: string;
    quantity: number;
    createdAt: string;
}

export function ProfileChestTab() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("store");
    const [chestItems, setChestItems] = useState<ChestItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/chest")
            .then(r => r.ok ? r.json() : { items: [] })
            .then(data => setChestItems(data.items || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const redeem = async (id: string) => {
        try {
            const res = await fetch(`/api/v1/chest/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error("redeem failed");
            setChestItems(prev => prev.filter((c) => c.id !== id));
        } catch {
            toast.error(t("tab_chest_redeemError"));
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <div className="w-6 h-6 border-2 border-border border-t-gray-600 rounded-full animate-spin mx-auto" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader><CardTitle>{t("tab_chest_title")}</CardTitle></CardHeader>
            <CardContent>
                {chestItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t("tab_chest_empty")}</p>
                ) : (
                    <div className="space-y-3">
                        {chestItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div>
                                    <p className="font-medium">{item.productName}</p>
                                    <p className="text-xs text-muted-foreground">{t("tab_chest_qty")}: {item.quantity} · {new Date(item.createdAt).toLocaleDateString(__dateTag)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => redeem(item.id)}>{t("tab_chest_redeem")}</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default ProfileChestTab;
