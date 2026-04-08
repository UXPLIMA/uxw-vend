"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { ActivityFeedList, type ActivityItem } from "@/core/components/activity/ActivityFeedList";

export function ActivityTab() {
    const [items, setItems] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/activity-feed?scope=mine&limit=50")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d: { items?: ActivityItem[] }) => {
                if (!cancelled) setItems(d.items || []);
            })
            .catch(() => {
                if (!cancelled) setItems([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    My Activity
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <ActivityFeedList items={items} />
                )}
            </CardContent>
        </Card>
    );
}
