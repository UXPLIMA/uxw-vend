"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

interface LogEntry {
    id: string;
    action: string;
    entity: string | null;
    entityId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    user: { id: string; username: string } | null;
}

export default function ActivityLogPage() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("admin");
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = useCallback(() => {
        setLoading(true);
        fetch(`/api/v1/activity-log?page=${page}`)
            .then((r) => r.json())
            .then((d) => { setLogs(d.logs || []); setTotalPages(d.pages || 1); setLoading(false); })
            .catch(() => setLoading(false));
    }, [page]);

     
    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("activityLog_title")}</h1>
                <p className="text-muted-foreground">{t("activityLog_subtitle")}</p>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : logs.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t("activityLog_noLogs")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t("activityLog_user")}</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t("activityLog_action")}</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t("activityLog_entity")}</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t("activityLog_date")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                                            <td className="py-3 px-4 text-sm">{log.user?.username || t("activityLog_system")}</td>
                                            <td className="py-3 px-4"><code className="text-xs bg-muted px-2 py-0.5 rounded">{log.action}</code></td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">{log.entity ? `${log.entity}/${log.entityId}` : "-"}</td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(log.createdAt).toLocaleString("tr-TR")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <span className="text-sm text-muted-foreground">{t("activityLog_page", { page, total: totalPages })}</span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
