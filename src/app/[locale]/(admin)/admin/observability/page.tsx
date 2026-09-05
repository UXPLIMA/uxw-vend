"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import {
    Activity, Database, Server, Mail, Clock, AlertCircle,
    CheckCircle2, XCircle, MinusCircle, Loader2, Users, Puzzle, History,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { dateLocaleTag } from "@/core/lib/utils";
import { LoadFailed } from "@/core/components/ui/load-failed";

interface HealthData {
    status: "ok" | "degraded" | "down";
    timestamp: string;
    checks: {
        database: { ok: boolean; latencyMs?: number; error?: string };
        redis: { ok: boolean; enabled: boolean; error?: string };
        emailQueue: { ok: boolean; pending: number; failed: number; error?: string };
        scheduler: { ok: boolean; staleJobs: number; error?: string };
    };
    version: string;
}

interface CronError {
    jobKey: string;
    lastRunAt: string;
    lastError: string | null;
    lastRunMs: number | null;
    nextRunAt: string | null;
}

interface FailedEmail {
    id: string;
    to: string;
    subject: string;
    attempts: number;
    lastError: string | null;
    createdAt: string;
}

interface StatsData {
    activityFeed: { last24h: number; last7d: number };
    users: number;
    enabledModules: number;
    revisions: number;
}

const REFRESH_INTERVAL_MS = 10_000;

function StatusDot({ ok, disabled = false }: { ok: boolean; disabled?: boolean }) {
    if (disabled) return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
    return ok
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        : <XCircle className="w-4 h-4 text-rose-500" />;
}

export default function ObservabilityPage() {
    const __locale = useLocale();
    const __dateTag = dateLocaleTag(__locale);
    const t = useTranslations("admin");
    const [health, setHealth] = useState<HealthData | null>(null);
    const [errors, setErrors] = useState<CronError[]>([]);
    const [emails, setEmails] = useState<FailedEmail[]>([]);
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    // Per panel, because they arrive from four independent requests. "No
    // errors" is the worst thing this page can say when it simply did not
    // hear back, so a panel that failed says so rather than reading clean.
    const [errorsFailed, setErrorsFailed] = useState(false);
    const [emailsFailed, setEmailsFailed] = useState(false);

    const fetchAll = useCallback(async () => {
        setRefreshing(true);
        try {
            const [healthRes, errorsRes, emailsRes, statsRes] = await Promise.all([
                fetch("/api/health", { cache: "no-store" }).then(r => r.json()).catch(() => null),
                fetch("/api/v1/admin/observability/recent-errors", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
                fetch("/api/v1/admin/observability/failed-emails", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
                fetch("/api/v1/admin/observability/stats", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
            ]);
            // 429/503 error responses omit `checks` - keep the last successful
            // snapshot on screen instead of crashing downstream accessors.
            if (healthRes && typeof healthRes === "object" && "checks" in healthRes) {
                setHealth(healthRes as HealthData);
            }
            if (errorsRes?.data) setErrors(errorsRes.data as CronError[]);
            setErrorsFailed(!errorsRes?.data);
            if (emailsRes?.data) setEmails(emailsRes.data as FailedEmail[]);
            setEmailsFailed(!emailsRes?.data);
            if (statsRes?.data) setStats(statsRes.data as StatsData);
            setLastRefresh(new Date());
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        const id = setInterval(fetchAll, REFRESH_INTERVAL_MS);
        return () => clearInterval(id);
    }, [fetchAll]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("observability_title")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t("observability_subtitle")}
                        {health?.version && <span className="ml-2 text-xs">v{health.version}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {refreshing && <Loader2 className="w-3 h-3 animate-spin" />}
                    {lastRefresh && (
                        <span>
                            {t("observability_lastRefresh")}: {lastRefresh.toLocaleTimeString(__dateTag)}
                        </span>
                    )}
                </div>
            </div>

            {/* Status cards row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Database className="w-4 h-4 text-blue-500" />
                            {t("observability_database")}
                            <StatusDot ok={health?.checks.database.ok ?? false} />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                        {health?.checks.database.ok ? (
                            <div>
                                <span className="font-mono text-lg">{health.checks.database.latencyMs}ms</span>
                                <p className="text-xs text-muted-foreground">
                                    {t("observability_latency")}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-rose-500">{health?.checks.database.error ?? "unreachable"}</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Server className="w-4 h-4 text-purple-500" />
                            Redis
                            <StatusDot
                                ok={health?.checks.redis.ok ?? false}
                                disabled={health?.checks.redis.enabled === false}
                            />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                        {health?.checks.redis.enabled === false ? (
                            <p className="text-xs text-muted-foreground">
                                {t("observability_notConfigured")}
                            </p>
                        ) : health?.checks.redis.ok ? (
                            <p className="text-xs text-emerald-500">connected</p>
                        ) : (
                            <p className="text-xs text-rose-500">{health?.checks.redis.error ?? "unreachable"}</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Mail className="w-4 h-4 text-rose-500" />
                            {t("observability_emailQueue")}
                            <StatusDot ok={health?.checks.emailQueue.ok ?? false} />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">pending</span>
                            <span className="font-mono">{health?.checks.emailQueue.pending ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">failed</span>
                            <span className="font-mono text-rose-500">{health?.checks.emailQueue.failed ?? 0}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            {t("observability_scheduler")}
                            <StatusDot ok={health?.checks.scheduler.ok ?? false} />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                        <div>
                            <span className="font-mono text-lg">{health?.checks.scheduler.staleJobs ?? 0}</span>
                            <p className="text-xs text-muted-foreground">
                                {t("observability_staleJobs")}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Activity stats row */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-500" />
                                {t("observability_activity24h")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <span className="font-mono text-2xl">{stats.activityFeed.last24h}</span>
                            <p className="text-xs text-muted-foreground">
                                {t("observability_activity7d")}: {stats.activityFeed.last7d}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500" />
                                {t("observability_users")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <span className="font-mono text-2xl">{stats.users}</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Puzzle className="w-4 h-4 text-purple-500" />
                                {t("observability_modules")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <span className="font-mono text-2xl">{stats.enabledModules}</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <History className="w-4 h-4 text-cyan-500" />
                                {t("observability_revisions")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <span className="font-mono text-2xl">{stats.revisions}</span>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Recent errors + failed emails */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            {t("observability_recentErrors")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {errorsFailed ? (
                            <LoadFailed onRetry={fetchAll} />
                        ) : errors.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t("observability_noErrors")}
                            </p>
                        ) : (
                            <ul className="space-y-2 text-sm">
                                {errors.map((e) => (
                                    <li key={e.jobKey} className="border-l-2 border-rose-500 pl-3">
                                        <div className="font-mono text-xs font-semibold">{e.jobKey}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(e.lastRunAt).toLocaleString(__dateTag)}
                                        </div>
                                        {e.lastError && (
                                            <div className="text-xs text-rose-500 truncate">{e.lastError}</div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Mail className="w-4 h-4 text-rose-500" />
                            {t("observability_failedEmails")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {emailsFailed ? (
                            <LoadFailed onRetry={fetchAll} />
                        ) : emails.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t("observability_noFailedEmails")}
                            </p>
                        ) : (
                            <ul className="space-y-2 text-sm">
                                {emails.map((e) => (
                                    <li key={e.id} className="border-l-2 border-rose-500 pl-3">
                                        <div className="font-semibold text-xs truncate">{e.subject}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {e.to} - {e.attempts} attempts
                                        </div>
                                        {e.lastError && (
                                            <div className="text-xs text-rose-500 truncate">{e.lastError}</div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
