"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2 } from "lucide-react";
import { useModuleStatus } from "@/core/providers/module-provider";
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
    const storeEnabled = useModuleStatus('store');
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

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 10 } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 10 } } },
        },
    };

    // Only build charts for enabled modules
    const charts: { title: string; value: string; color: string; chart: React.ReactNode; span?: boolean }[] = [];

    if (storeEnabled) {
        charts.push({
            title: "Revenue", value: `$${data.totals.revenue.toFixed(2)}`, color: "text-green-600",
            chart: <Line data={{ labels: shortLabels, datasets: [{ label: "Revenue ($)", data: data.revenue, borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.1)", fill: true, tension: 0.3, pointRadius: 2 }] }} options={chartOptions} />,
        });
        charts.push({
            title: "Orders", value: String(data.totals.orders), color: "text-blue-600",
            chart: <Bar data={{ labels: shortLabels, datasets: [{ label: "Orders", data: data.orders, backgroundColor: "#3b82f6", borderRadius: 4 }] }} options={chartOptions} />,
        });
    }

    charts.push({
        title: "New Users", value: String(data.totals.users), color: "text-purple-600", span: true,
        chart: <Line data={{ labels: shortLabels, datasets: [{ label: "New Users", data: data.users, borderColor: "#8b5cf6", backgroundColor: "rgba(139,92,246,0.1)", fill: true, tension: 0.3, pointRadius: 2 }] }} options={chartOptions} />,
    });

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                {[{ label: "7 Days", value: "7" }, { label: "30 Days", value: "30" }, { label: "90 Days", value: "90" }].map((p) => (
                    <Button key={p.value} variant={period === p.value ? "default" : "outline"} size="sm" onClick={() => setPeriod(p.value)}>
                        {p.label}
                    </Button>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {charts.map((c) => (
                    <Card key={c.title} className={c.span ? "lg:col-span-2" : ""}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px]">{c.chart}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
