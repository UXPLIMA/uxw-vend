"use client";

import { useState, useEffect } from "react";
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
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

interface StatsData {
    labels: string[];
    revenue: number[];
    orders: number[];
    users: number[];
    totals: { revenue: number; orders: number; users: number };
}

export function DashboardCharts() {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState("30");

    useEffect(() => {
        setLoading(true);
        fetch(`/api/v1/stats?period=${period}d`)
            .then((r) => r.json())
            .then((d) => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [period]);

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

    const revenueChartData = {
        labels: shortLabels,
        datasets: [{
            label: "Revenue ($)",
            data: data.revenue,
            borderColor: "#22c55e",
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 2,
        }],
    };

    const ordersChartData = {
        labels: shortLabels,
        datasets: [{
            label: "Orders",
            data: data.orders,
            backgroundColor: "#3b82f6",
            borderRadius: 4,
        }],
    };

    const usersChartData = {
        labels: shortLabels,
        datasets: [{
            label: "New Users",
            data: data.users,
            borderColor: "#8b5cf6",
            backgroundColor: "rgba(139, 92, 246, 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 2,
        }],
    };

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
            {/* Period Selector */}
            <div className="flex gap-2">
                {[{ label: "7 Days", value: "7" }, { label: "30 Days", value: "30" }, { label: "90 Days", value: "90" }].map((p) => (
                    <Button key={p.value} variant={period === p.value ? "default" : "outline"} size="sm" onClick={() => setPeriod(p.value)}>
                        {p.label}
                    </Button>
                ))}
            </div>

            {/* Charts Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                        <p className="text-2xl font-bold text-green-600">${data.totals.revenue.toFixed(2)}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            <Line data={revenueChartData} options={chartOptions} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
                        <p className="text-2xl font-bold text-blue-600">{data.totals.orders}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            <Bar data={ordersChartData} options={chartOptions} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">New Users</CardTitle>
                        <p className="text-2xl font-bold text-purple-600">{data.totals.users}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            <Line data={usersChartData} options={chartOptions} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
