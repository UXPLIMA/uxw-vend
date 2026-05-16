"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import {
    ChevronLeft,
    ChevronRight,
    Download,
    Loader2,
    Filter as FilterIcon,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface AuditLogEntry {
    id: string;
    action: string;
    entity: string | null;
    entityId: string | null;
    metadata: unknown;
    ipAddress: string | null;
    createdAt: string;
    user: { id: string; username: string } | null;
}

interface AuditLogResponse {
    logs: AuditLogEntry[];
    total: number;
    page: number;
    pages: number;
    actions: string[];
}

type ActionColor = {
    bg: string;
    text: string;
    border: string;
    label: string;
};

function classifyAction(action: string): ActionColor {
    // Highest sensitivity — purple
    if (
        action.startsWith("backup.") ||
        action.endsWith(".restore") ||
        action.startsWith("user.role.")
    ) {
        return {
            bg: "bg-purple-500/10",
            text: "text-purple-700 dark:text-purple-300",
            border: "border-purple-500/30",
            label: "sensitive",
        };
    }
    if (action.endsWith(".install") || action.endsWith(".activate")) {
        return {
            bg: "bg-cyan-500/10",
            text: "text-cyan-700 dark:text-cyan-300",
            border: "border-cyan-500/30",
            label: "install",
        };
    }
    if (
        action.endsWith(".delete") ||
        action.endsWith(".revoke") ||
        action.endsWith(".uninstall")
    ) {
        return {
            bg: "bg-red-500/10",
            text: "text-red-700 dark:text-red-300",
            border: "border-red-500/30",
            label: "destructive",
        };
    }
    if (action.endsWith(".create")) {
        return {
            bg: "bg-emerald-500/10",
            text: "text-emerald-700 dark:text-emerald-300",
            border: "border-emerald-500/30",
            label: "create",
        };
    }
    if (action.endsWith(".update")) {
        return {
            bg: "bg-blue-500/10",
            text: "text-blue-700 dark:text-blue-300",
            border: "border-blue-500/30",
            label: "update",
        };
    }
    return {
        bg: "bg-gray-500/10",
        text: "text-gray-700 dark:text-gray-300",
        border: "border-gray-500/30",
        label: "other",
    };
}

function truncate(str: string, max = 80): string {
    return str.length > max ? str.slice(0, max) + "…" : str;
}

function MetadataCell({ metadata }: { metadata: unknown }) {
    const [expanded, setExpanded] = useState(false);
    if (metadata == null || metadata === "") {
        return <span className="text-muted-foreground">—</span>;
    }
    const json = JSON.stringify(metadata, null, 2);
    const single = JSON.stringify(metadata);
    return (
        <div>
            <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex items-start gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
            >
                {expanded ? (
                    <ChevronUp className="w-3 h-3 mt-0.5 shrink-0" />
                ) : (
                    <ChevronDown className="w-3 h-3 mt-0.5 shrink-0" />
                )}
                <code className="break-all">
                    {expanded ? null : truncate(single, 60)}
                </code>
            </button>
            {expanded && (
                <pre className="mt-1 max-w-md overflow-x-auto rounded bg-muted p-2 text-xs">
                    {json}
                </pre>
            )}
        </div>
    );
}

export default function AuditLogPage() {
    const t = useTranslations("admin");

    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [actions, setActions] = useState<string[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);

    const [actionFilter, setActionFilter] = useState("");
    const [userFilter, setUserFilter] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const queryString = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set("page", String(page));
        sp.set("limit", "50");
        if (actionFilter) sp.set("action", actionFilter);
        if (userFilter) sp.set("userId", userFilter);
        if (fromDate) sp.set("from", fromDate);
        if (toDate) sp.set("to", toDate);
        return sp.toString();
    }, [page, actionFilter, userFilter, fromDate, toDate]);

    const fetchLogs = useCallback(() => {
        setLoading(true);
        fetch(`/api/v1/admin/audit-log?${queryString}`)
            .then((r) => r.json())
            .then((d: AuditLogResponse) => {
                setLogs(d.logs || []);
                setTotal(d.total || 0);
                setPages(d.pages || 1);
                setActions(d.actions || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [queryString]);

     
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const exportCsv = () => {
        const sp = new URLSearchParams(queryString);
        sp.set("export", "csv");
        sp.delete("page");
        sp.delete("limit");
        window.location.href = `/api/v1/admin/audit-log?${sp.toString()}`;
    };

    const resetPageAndSet = <T,>(setter: (v: T) => void) => (v: T) => {
        setPage(1);
        setter(v);
    };

    const title = t.has("auditLog_title") ? t("auditLog_title") : "Audit Log";
    const subtitle = t.has("auditLog_subtitle")
        ? t("auditLog_subtitle")
        : "Review sensitive admin actions across the platform.";

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold">{title}</h1>
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="w-4 h-4 mr-2" />
                    {t.has("auditLog_exportCsv") ? t("auditLog_exportCsv") : "Export CSV"}
                </Button>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground flex items-center gap-1">
                                <FilterIcon className="w-3 h-3" />
                                {t.has("auditLog_action") ? t("auditLog_action") : "Action"}
                            </label>
                            <select
                                value={actionFilter}
                                onChange={(e) =>
                                    resetPageAndSet(setActionFilter)(e.target.value)
                                }
                                className="h-9 rounded-md border bg-background px-3 text-sm min-w-48"
                            >
                                <option value="">
                                    {t.has("auditLog_allActions")
                                        ? t("auditLog_allActions")
                                        : "All actions"}
                                </option>
                                {actions.map((a) => (
                                    <option key={a} value={a}>
                                        {a}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">
                                {t.has("auditLog_userId")
                                    ? t("auditLog_userId")
                                    : "User ID"}
                            </label>
                            <Input
                                value={userFilter}
                                onChange={(e) =>
                                    resetPageAndSet(setUserFilter)(e.target.value)
                                }
                                placeholder="cuid..."
                                className="h-9 w-52"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">
                                {t.has("auditLog_from") ? t("auditLog_from") : "From"}
                            </label>
                            <Input
                                type="date"
                                value={fromDate}
                                onChange={(e) =>
                                    resetPageAndSet(setFromDate)(e.target.value)
                                }
                                className="h-9 w-40"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">
                                {t.has("auditLog_to") ? t("auditLog_to") : "To"}
                            </label>
                            <Input
                                type="date"
                                value={toDate}
                                onChange={(e) =>
                                    resetPageAndSet(setToDate)(e.target.value)
                                }
                                className="h-9 w-40"
                            />
                        </div>

                        {(actionFilter || userFilter || fromDate || toDate) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setActionFilter("");
                                    setUserFilter("");
                                    setFromDate("");
                                    setToDate("");
                                    setPage(1);
                                }}
                            >
                                {t.has("auditLog_clear") ? t("auditLog_clear") : "Clear"}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">
                            {t.has("auditLog_noLogs")
                                ? t("auditLog_noLogs")
                                : "No audit log entries match the current filters."}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left py-2 px-4 font-medium text-xs text-muted-foreground">
                                            {t.has("auditLog_timestamp")
                                                ? t("auditLog_timestamp")
                                                : "Timestamp"}
                                        </th>
                                        <th className="text-left py-2 px-4 font-medium text-xs text-muted-foreground">
                                            {t.has("auditLog_user")
                                                ? t("auditLog_user")
                                                : "User"}
                                        </th>
                                        <th className="text-left py-2 px-4 font-medium text-xs text-muted-foreground">
                                            {t.has("auditLog_action")
                                                ? t("auditLog_action")
                                                : "Action"}
                                        </th>
                                        <th className="text-left py-2 px-4 font-medium text-xs text-muted-foreground">
                                            {t.has("auditLog_target")
                                                ? t("auditLog_target")
                                                : "Target"}
                                        </th>
                                        <th className="text-left py-2 px-4 font-medium text-xs text-muted-foreground">
                                            {t.has("auditLog_metadata")
                                                ? t("auditLog_metadata")
                                                : "Metadata"}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => {
                                        const color = classifyAction(log.action);
                                        return (
                                            <tr
                                                key={log.id}
                                                className="border-b last:border-0 hover:bg-muted/30"
                                            >
                                                <td className="py-2 px-4 whitespace-nowrap text-xs text-muted-foreground">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </td>
                                                <td className="py-2 px-4 whitespace-nowrap">
                                                    {log.user ? (
                                                        <Link
                                                            href={`/profile/${log.user.username}`}
                                                            className="text-primary hover:underline"
                                                        >
                                                            {log.user.username}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">
                                                            system
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-4 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono ${color.bg} ${color.text} ${color.border}`}
                                                    >
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-4 text-xs text-muted-foreground">
                                                    {log.entity ? (
                                                        <code className="text-xs">
                                                            {log.entity}
                                                            {log.entityId
                                                                ? `/${log.entityId}`
                                                                : ""}
                                                        </code>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>
                                                <td className="py-2 px-4 align-top">
                                                    <MetadataCell metadata={log.metadata} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex items-center justify-between p-4 border-t">
                        <span className="text-sm text-muted-foreground">
                            {total}{" "}
                            {t.has("auditLog_entries")
                                ? t("auditLog_entries")
                                : "entries"}{" "}
                            · {t.has("auditLog_page") ? t("auditLog_page") : "page"} {page}
                            {" / "}
                            {pages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= pages}
                                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
