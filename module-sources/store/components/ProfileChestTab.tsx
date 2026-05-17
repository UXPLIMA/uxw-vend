"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";

interface ChestItem {
    id: string;
    productName: string;
    quantity: number;
    createdAt: string;
}

export function ProfileChestTab() {
    const [chestItems, setChestItems] = useState<ChestItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/chest")
            .then(r => r.ok ? r.json() : { items: [] })
            .then(data => setChestItems(data.items || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

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
            <CardHeader><CardTitle>My Chest</CardTitle></CardHeader>
            <CardContent>
                {chestItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Your chest is empty. Purchase items to store them here.</p>
                ) : (
                    <div className="space-y-3">
                        {chestItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div>
                                    <p className="font-medium">{item.productName}</p>
                                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} · {new Date(item.createdAt).toLocaleDateString("tr-TR")}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={async () => {
                                        await fetch(`/api/v1/chest/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
                                        setChestItems(prev => prev.filter((c) => c.id !== item.id));
                                    }}>Redeem</Button>
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
