"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Activity as ActivityIcon, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface CheckState { ok: boolean; enabled?: boolean }
interface HealthResponse {
    status: "ok" | "degraded" | "down";
    checks: {
        database: CheckState & { latencyMs?: number };
        redis: CheckState;
        emailQueue: CheckState & { pending: number; failed: number };
        scheduler: CheckState & { staleJobs: number };
    };
}

/**
 * Health snapshot widget — polls /api/health every 15s.
 */
export default function HealthSnapshotWidget() {
    const t = useTranslations("admin");
    const [data, setData] = useState<HealthResponse | null>(null);

    useEffect(() => {
        let active = true;
        const tick = () => {
            fetch("/api/health")
                .then((r) => r.json())
                .then((d: HealthResponse) => { if (active) setData(d); })
                .catch(() => undefined);
        };
        tick();
        const id = setInterval(tick, 15_000);
        return () => { active = false; clearInterval(id); };
    }, []);

    const dot = (ok: boolean, enabled: boolean = true) => (
        <span
            className={`inline-block w-2 h-2 rounded-full ${
                !enabled ? "bg-muted-foreground/30" : ok ? "bg-green-500" : "bg-red-500"
            }`}
        />
    );

    return (
        <Link href="/admin/observability" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <ActivityIcon className="w-4 h-4" />
                            {t("widget_health")}
                        </span>
                        {data && (data.status === "ok"
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-xs space-y-1">
                    {!data ? (
                        <p className="text-muted-foreground">{t("widget_loading")}</p>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">{dot(data.checks.database.ok)} {t("widget_database")} {data.checks.database.latencyMs && <span className="text-muted-foreground">({data.checks.database.latencyMs}ms)</span>}</div>
                            <div className="flex items-center gap-2">{dot(data.checks.redis.ok, data.checks.redis.enabled)} Redis {data.checks.redis.enabled === false && <span className="text-muted-foreground">({t("widget_disabled")})</span>}</div>
                            <div className="flex items-center gap-2">{dot(data.checks.emailQueue.ok)} {t("widget_emailQueue")} <span className="text-muted-foreground">({data.checks.emailQueue.pending}/{data.checks.emailQueue.failed})</span></div>
                            <div className="flex items-center gap-2">{dot(data.checks.scheduler.ok)} {t("widget_scheduler")} {data.checks.scheduler.staleJobs > 0 && <span className="text-muted-foreground">({data.checks.scheduler.staleJobs} {t("widget_stale")})</span>}</div>
                        </>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
