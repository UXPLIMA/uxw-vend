"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2 } from "lucide-react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Filler,
    Tooltip,
    Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

interface StatsData {
    labels: string[];
    users: number[];
    totals: { users: number };
}

/**
 * Dashboard charts — only shows core data (Users).
 * Module-specific charts (Revenue, Orders) come from module statsApi via DashboardClient.
 */
export function DashboardCharts() {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState("30");

    const fetchStats = useCallback(() => {
        setLoading(true);
        fetch(`/api/v1/stats?period=${period}d`)
            .then((r) => r.json())
            .then((d) => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [period]);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on period change
    useEffect(() => { fetchStats(); }, [fetchStats]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!data) return null;

    const shortLabels = data.labels.map((l) => {
        const d = new Date(l);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 10 } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 10 } } },
        },
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                {[{ label: "7 Days", value: "7" }, { label: "30 Days", value: "30" }, { label: "90 Days", value: "90" }].map((p) => (
                    <Button key={p.value} variant={period === p.value ? "default" : "outline"} size="sm" onClick={() => setPeriod(p.value)}>
                        {p.label}
                    </Button>
                ))}
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">New Users</CardTitle>
                    <p className="text-2xl font-bold text-purple-600">{data.totals.users}</p>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px]">
                        <Line data={{
                            labels: shortLabels,
                            datasets: [{
                                label: "New Users",
                                data: data.users,
                                borderColor: "#8b5cf6",
                                backgroundColor: "rgba(139,92,246,0.1)",
                                fill: true,
                                tension: 0.3,
                                pointRadius: 2,
                            }],
                        }} options={chartOptions} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
