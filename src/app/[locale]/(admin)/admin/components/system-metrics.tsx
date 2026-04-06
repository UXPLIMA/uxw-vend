"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Activity, Clock, AlertTriangle, Zap } from "lucide-react";

interface MetricsData {
    total: { requests: number; errors: number };
    last5min: { requests: number; avgResponseMs: number; p95ResponseMs: number; errorRate: number };
    lastHour: { requests: number; avgResponseMs: number; p95ResponseMs: number; errorRate: number; statusCodes: Record<string, number> };
    slowEndpoints: { endpoint: string; count: number; avgMs: number; errors: number }[];
}

export function SystemMetrics() {
    const [data, setData] = useState<MetricsData | null>(null);

    const fetchMetrics = useCallback(() => {
        fetch("/api/v1/admin/metrics")
            .then((r) => r.ok ? r.json() : null)
            .then((d) => setData(d))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchMetrics]);

    if (!data) return null;

    const statCards = [
        { label: "Requests (5m)", value: data.last5min.requests, icon: Activity, color: "text-blue-500" },
        { label: "Avg Response", value: `${data.last5min.avgResponseMs}ms`, icon: Clock, color: "text-green-500" },
        { label: "P95 Response", value: `${data.last5min.p95ResponseMs}ms`, icon: Zap, color: "text-purple-500" },
        { label: "Error Rate", value: `${data.last5min.errorRate}%`, icon: AlertTriangle, color: data.last5min.errorRate > 5 ? "text-red-500" : "text-green-500" },
    ];

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">System Metrics</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statCards.map((card) => (
                    <Card key={card.label}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
                                <card.icon className={`w-4 h-4 ${card.color}`} />
                            </div>
                            <div className="text-2xl font-bold">{card.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {data.slowEndpoints.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Slowest Endpoints (Last Hour)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            {data.slowEndpoints.slice(0, 5).map((ep) => (
                                <div key={ep.endpoint} className="flex items-center justify-between py-2 text-sm border-b last:border-0">
                                    <code className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[60%]">{ep.endpoint}</code>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>{ep.count}x</span>
                                        <span className="font-medium text-foreground">{ep.avgMs}ms</span>
                                        {ep.errors > 0 && <span className="text-red-500">{ep.errors} err</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex gap-2 text-xs text-muted-foreground">
                <span>Total: {data.total.requests} requests</span>
                <span>|</span>
                <span>Last hour: {data.lastHour.requests} requests, {data.lastHour.errorRate}% errors</span>
            </div>
        </div>
    );
}
