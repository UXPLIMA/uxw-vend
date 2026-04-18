"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAllModules } from "@/core/providers/module-provider";
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

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Filler,
    Tooltip,
    Legend,
);

interface ChartSeries {
    id: string;
    label: string;
    labelKey?: string;
    labels: string[];
    data: number[];
    color?: string;
    format?: "currency" | "number";
    source?: string;
}

interface CoreStatsResponse {
    labels: string[];
    users: number[];
    totals: { users: number };
}

interface ModuleManifest {
    id: string;
    statsApi?: string;
}

const PERIODS = [
    { key: "7", labelKey: "analytics_period_7" },
    { key: "30", labelKey: "analytics_period_30" },
    { key: "90", labelKey: "analytics_period_90" },
    { key: "365", labelKey: "analytics_period_365" },
];

function sum(data: number[]): number {
    return data.reduce((a, b) => a + b, 0);
}

function formatTotal(total: number, fmt?: string): string {
    if (fmt === "currency") return `$${total.toFixed(2)}`;
    if (Number.isInteger(total)) return total.toLocaleString();
    return total.toFixed(2);
}

export default function AnalyticsPage() {
    const t = useTranslations("admin");
    const moduleStates = useAllModules();
    const [period, setPeriod] = useState<string>("30");
    const [charts, setCharts] = useState<ChartSeries[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const collected: ChartSeries[] = [];

        // Core users chart
        try {
            const res = await fetch(`/api/v1/stats?period=${period}d`);
            if (res.ok) {
                const d: CoreStatsResponse = await res.json();
                if (d.labels?.length && d.users?.length) {
                    collected.push({
                        id: "core-users",
                        label: "New users per day",
                        labelKey: "analytics_newUsersPerDay",
                        labels: d.labels,
                        data: d.users,
                        color: "#6366f1",
                        source: "core",
                    });
                }
            }
        } catch { /* skip */ }

        // Module charts
        try {
            const res = await fetch("/api/v1/modules");
            if (res.ok) {
                const data = await res.json();
                const enabledModules = ((data.modules || []) as ModuleManifest[])
                    .filter((m) => moduleStates[m.id] === true && !!m.statsApi);

                const fetches = enabledModules.map(async (m) => {
                    try {
                        const url = `/api/v1${m.statsApi}?period=${period}`;
                        const r = await fetch(url);
                        if (!r.ok) return;
                        const body = await r.json();
                        if (Array.isArray(body.charts)) {
                            for (const c of body.charts) {
                                collected.push({ ...c, source: m.id });
                            }
                        }
                    } catch { /* skip */ }
                });
                await Promise.all(fetches);
            }
        } catch { /* skip */ }

        setCharts(collected);
        setLoading(false);
    }, [period, moduleStates]);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    const translateLabel = (raw: string, key?: string): string => {
        if (!key) return raw;
        try {
            const tx = t(key);
            return tx && tx !== key ? tx : raw;
        } catch {
            return raw;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("analytics_title")}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t("analytics_description")}</p>
                </div>
                <div className="flex gap-1 rounded-lg border border-border p-1 bg-card">
                    {PERIODS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                                period === p.key
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                        >
                            {t(p.labelKey as "analytics_period_30")}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("analytics_loading")}
                    </div>
                </div>
            ) : charts.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground text-sm">
                        {t("analytics_noCharts")}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {charts.map((chart) => {
                        const color = chart.color ?? "#6366f1";
                        const total = sum(chart.data);
                        return (
                            <Card key={chart.id}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <CardTitle className="text-sm">
                                            {translateLabel(chart.label, chart.labelKey)}
                                        </CardTitle>
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                                                {t("analytics_total")}
                                            </div>
                                            <div className="text-lg font-bold" style={{ color }}>
                                                {formatTotal(total, chart.format)}
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-48">
                                        <Line
                                            data={{
                                                labels: chart.labels,
                                                datasets: [
                                                    {
                                                        label: translateLabel(chart.label, chart.labelKey),
                                                        data: chart.data,
                                                        borderColor: color,
                                                        backgroundColor: color + "22",
                                                        fill: true,
                                                        tension: 0.35,
                                                        pointRadius: 0,
                                                        pointHoverRadius: 4,
                                                        borderWidth: 2,
                                                    },
                                                ],
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { display: false },
                                                    tooltip: {
                                                        callbacks: {
                                                            label: (ctx) => {
                                                                const v = ctx.parsed.y;
                                                                if (chart.format === "currency") return `$${Number(v).toFixed(2)}`;
                                                                return String(v);
                                                            },
                                                        },
                                                    },
                                                },
                                                scales: {
                                                    x: {
                                                        display: true,
                                                        ticks: {
                                                            maxTicksLimit: 6,
                                                            color: "rgb(var(--muted-foreground-rgb, 120 120 120) / 1)",
                                                            font: { size: 10 },
                                                        },
                                                        grid: { display: false },
                                                    },
                                                    y: {
                                                        display: true,
                                                        beginAtZero: true,
                                                        ticks: {
                                                            maxTicksLimit: 5,
                                                            color: "rgb(var(--muted-foreground-rgb, 120 120 120) / 1)",
                                                            font: { size: 10 },
                                                        },
                                                        grid: { color: "rgba(150, 150, 150, 0.1)" },
                                                    },
                                                },
                                            }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
