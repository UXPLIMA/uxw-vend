"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

interface CronJobRow {
    key: string;
    schedule: string;
    lastRunAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
    lastRunMs: number | null;
    nextRunAt: string | null;
}

const STATUS_BADGE: Record<string, string> = {
    ok: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function formatDate(value: string | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleString();
}

function formatDuration(ms: number | null): string {
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

export default function CronAdminPage() {
    const t = useTranslations("admin");
    const [jobs, setJobs] = useState<CronJobRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [runningKey, setRunningKey] = useState<string | null>(null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const { confirm } = useConfirm();

    const fetchJobs = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/admin/cron");
            if (!res.ok) {
                toast.error(t("cron_loadFailed"));
                return;
            }
            const data = await res.json();
            setJobs(data.jobs || []);
        } catch {
            toast.error(t("cron_loadFailed"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchJobs();
        const interval = setInterval(() => { void fetchJobs(); }, 10_000);
        return () => clearInterval(interval);
    }, [fetchJobs]);

    const handleRunNow = async (job: CronJobRow) => {
        const ok = await confirm({
            title: t("cron_runJobTitle"),
            message: t("cron_runJobMessage", { key: job.key }),
            confirmText: t("cron_runJobConfirm"),
        });
        if (!ok) return;

        setRunningKey(job.key);
        try {
            const res = await fetch(`/api/v1/admin/cron/${encodeURIComponent(job.key)}/run`, {
                method: "POST",
            });
            if (res.ok) {
                toast.success(t("cron_ranJob", { key: job.key }));
                void fetchJobs();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t("cron_runFailed"));
            }
        } catch {
            toast.error(t("cron_runFailed"));
        } finally {
            setRunningKey(null);
        }
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("cron_title")}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t("cron_description")}</p>
                </div>
                <Button variant="outline" onClick={() => void fetchJobs()} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    {t.has("common_refresh") ? t("common_refresh") : "Refresh"}
                </Button>
            </div>

            {loading && jobs.length === 0 ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : jobs.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {t("cron_noCronJobs")}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">{t("cron_jobKey")}</th>
                                    <th className="px-4 py-3 font-medium">{t("cron_schedule")}</th>
                                    <th className="px-4 py-3 font-medium">{t("cron_lastRun")}</th>
                                    <th className="px-4 py-3 font-medium">{t("common_status")}</th>
                                    <th className="px-4 py-3 font-medium">{t("cron_duration")}</th>
                                    <th className="px-4 py-3 font-medium">{t("cron_nextRun")}</th>
                                    <th className="px-4 py-3 font-medium text-right">{t("common_actions")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((job) => {
                                    const isExpanded = expandedKey === job.key;
                                    const hasError = job.lastStatus === "error" && job.lastError;
                                    return (
                                        <Fragment key={job.key}>
                                            <tr className="border-t border-border">
                                                <td className="px-4 py-3 font-mono text-xs">{job.key}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{job.schedule}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{formatDate(job.lastRunAt)}</td>
                                                <td className="px-4 py-3">
                                                    {job.lastStatus ? (
                                                        <span
                                                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${STATUS_BADGE[job.lastStatus] || "bg-muted text-muted-foreground"}`}
                                                            title={hasError ? job.lastError ?? "" : undefined}
                                                        >
                                                            {job.lastStatus}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">{formatDuration(job.lastRunMs)}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{formatDate(job.nextRunAt)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {hasError && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setExpandedKey(isExpanded ? null : job.key)}
                                                            >
                                                                {isExpanded ? t("cron_hide") : t("cron_error")}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRunNow(job)}
                                                            disabled={runningKey === job.key}
                                                        >
                                                            {runningKey === job.key ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Play className="w-3 h-3 mr-1" />
                                                            )}
                                                            {t("cron_runNow")}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && hasError && (
                                                <tr className="border-t border-border bg-muted/20">
                                                    <td colSpan={7} className="px-4 py-3">
                                                        <div className="text-xs font-mono text-destructive whitespace-pre-wrap break-all">
                                                            {job.lastError}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
