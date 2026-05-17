"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Play, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations, useLocale } from "next-intl";

type EmailStatus = "pending" | "sending" | "sent" | "failed";
type StatusFilter = "all" | EmailStatus;

interface EmailJobRow {
    id: string;
    to: string;
    subject: string;
    status: string;
    attempts: number;
    lastError: string | null;
    scheduledAt: string;
    sentAt: string | null;
    createdAt: string;
}

interface QueueResponse {
    jobs: EmailJobRow[];
    total: number;
    page: number;
    pageSize: number;
    summary: Record<EmailStatus, number>;
}

const STATUS_BADGE: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    sending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    sent: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const STATUS_CARD: { key: EmailStatus; labelKey: string; color: string }[] = [
    { key: "pending", labelKey: "emailQueue_pending", color: "text-blue-500" },
    { key: "sending", labelKey: "emailQueue_sending", color: "text-yellow-500" },
    { key: "sent", labelKey: "emailQueue_sent", color: "text-green-500" },
    { key: "failed", labelKey: "emailQueue_failed", color: "text-red-500" },
];

const TABS: { key: StatusFilter; labelKey: string }[] = [
    { key: "all", labelKey: "emailQueue_all" },
    { key: "pending", labelKey: "emailQueue_pending" },
    { key: "sending", labelKey: "emailQueue_sending" },
    { key: "sent", labelKey: "emailQueue_sent" },
    { key: "failed", labelKey: "emailQueue_failed" },
];

function formatDate(value: string | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleString("tr-TR");
}

export default function EmailQueueAdminPage() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("admin");
    const [jobs, setJobs] = useState<EmailJobRow[]>([]);
    const [summary, setSummary] = useState<Record<EmailStatus, number>>({ pending: 0, sending: 0, sent: 0, failed: 0 });
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { confirm } = useConfirm();

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== "all") params.set("status", filter);
            params.set("page", String(page));
            const res = await fetch(`/api/v1/admin/email-queue?${params.toString()}`);
            if (!res.ok) {
                toast.error(t("emailQueue_loadFailed"));
                return;
            }
            const data: QueueResponse = await res.json();
            setJobs(data.jobs || []);
            setTotal(data.total || 0);
            setPageSize(data.pageSize || 50);
            setSummary(data.summary || { pending: 0, sending: 0, sent: 0, failed: 0 });
        } catch {
            toast.error(t("emailQueue_loadFailed"));
        } finally {
            setLoading(false);
        }
    }, [filter, page, t]);

    useEffect(() => {
        void fetchJobs();
    }, [fetchJobs]);

    const handleProcess = async () => {
        const ok = await confirm({
            title: t("emailQueue_processTitle"),
            message: t("emailQueue_processConfirm"),
            confirmText: "Process",
        });
        if (!ok) return;

        setProcessing(true);
        try {
            const res = await fetch("/api/v1/admin/email-queue/process", { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                toast.success(
                    `Processed ${data.processed} · sent ${data.sent} · failed ${data.failed} · retried ${data.retried}`
                );
                void fetchJobs();
            } else {
                toast.error(t("emailQueue_processFailed"));
            }
        } catch {
            toast.error(t("emailQueue_processFailed"));
        } finally {
            setProcessing(false);
        }
    };

    const handleRetry = async (job: EmailJobRow) => {
        const ok = await confirm({
            title: t("emailQueue_retryTitle"),
            message: `Reset "${job.subject}" to pending and clear its attempts?`,
            confirmText: "Retry",
        });
        if (!ok) return;

        setBusyId(job.id);
        try {
            const res = await fetch(`/api/v1/admin/email-queue/${job.id}/retry`, { method: "POST" });
            if (res.ok) {
                toast.success(t("emailQueue_retrySuccess"));
                void fetchJobs();
            } else {
                toast.error(t("emailQueue_retryFailed"));
            }
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (job: EmailJobRow) => {
        const ok = await confirm({
            title: t("emailQueue_deleteTitle"),
            message: `Delete "${job.subject}"? This cannot be undone.`,
            variant: "danger",
        });
        if (!ok) return;

        setBusyId(job.id);
        try {
            const res = await fetch(`/api/v1/admin/email-queue/${job.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("emailQueue_jobDeleted"));
                void fetchJobs();
            } else {
                toast.error(t("emailQueue_deleteFailed"));
            }
        } finally {
            setBusyId(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("emailQueue_title")}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t("emailQueue_description")}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void fetchJobs()} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        {t.has("common_refresh") ? t("common_refresh") : "Refresh"}
                    </Button>
                    <Button onClick={handleProcess} disabled={processing}>
                        {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        {t("emailQueue_processNow")}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {STATUS_CARD.map((s) => (
                    <Card key={s.key}>
                        <CardContent className="p-4">
                            <div className="text-xs uppercase font-mono text-muted-foreground">{t(s.labelKey)}</div>
                            <div className={`text-2xl font-bold ${s.color}`}>{summary[s.key] ?? 0}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex gap-1 mb-4 border-b border-border">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => { setFilter(tab.key); setPage(1); }}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            filter === tab.key
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {t(tab.labelKey)}
                    </button>
                ))}
            </div>

            {loading && jobs.length === 0 ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : jobs.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {t("emailQueue_noJobs")}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">{t("emailQueue_to")}</th>
                                    <th className="px-4 py-3 font-medium">{t("common_subject")}</th>
                                    <th className="px-4 py-3 font-medium">{t("common_status")}</th>
                                    <th className="px-4 py-3 font-medium">{t("emailQueue_attempts")}</th>
                                    <th className="px-4 py-3 font-medium">{t("emailQueue_scheduled")}</th>
                                    <th className="px-4 py-3 font-medium text-right">{t("common_actions")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((job) => {
                                    const isExpanded = expandedId === job.id;
                                    const hasError = job.status === "failed" && job.lastError;
                                    return (
                                        <Fragment key={job.id}>
                                            <tr className="border-t border-border">
                                                <td className="px-4 py-3 truncate max-w-[200px]">{job.to}</td>
                                                <td className="px-4 py-3 truncate max-w-[260px]">{job.subject}</td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${STATUS_BADGE[job.status] || "bg-muted text-muted-foreground"}`}
                                                    >
                                                        {job.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">{job.attempts}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{formatDate(job.scheduledAt)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {hasError && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setExpandedId(isExpanded ? null : job.id)}
                                                            >
                                                                {isExpanded ? t("emailQueue_hide") : t("emailQueue_error")}
                                                            </Button>
                                                        )}
                                                        {job.status === "failed" && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleRetry(job)}
                                                                disabled={busyId === job.id}
                                                            >
                                                                <RotateCcw className="w-3 h-3 mr-1" />
                                                                {t("emailQueue_retry")}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive"
                                                            onClick={() => handleDelete(job)}
                                                            disabled={busyId === job.id}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && hasError && (
                                                <tr className="border-t border-border bg-muted/20">
                                                    <td colSpan={6} className="px-4 py-3">
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

            {total > pageSize && (
                <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                    <span>
                        {t("emailQueue_page")} {page} / {totalPages} · {total} total
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            {t("emailQueue_previous")}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            {t("emailQueue_next")}
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
