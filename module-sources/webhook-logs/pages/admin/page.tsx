"use client";


import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";

interface Log {
    id: string;
    event: string;
    url: string;
    status: number | null;
    response: string | null;
    createdAt: string;
}

export default function WebhookLogsPage() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("webhookLogs");
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        fetch(`/api/v1/webhook-logs?page=${page}`)
            .then((r) => r.json())
            .then((d) => { setLogs(d.logs || []); setTotalPages(d.pages || 1); setLoading(false); })
            .catch(() => setLoading(false));
    }, [page]);

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("adm_webhookLogs")}</h1>
                <p className="text-muted-foreground">{t("adm_deliveryHistory")}</p>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : logs.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t("adm_noLogsYet")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t("adm_status")}</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t("adm_event")}</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">URL</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t("adm_date")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                {log.status && log.status < 300 ? (
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 text-red-500" />
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <code className="text-xs bg-muted px-2 py-0.5 rounded">{log.event}</code>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground max-w-[300px] truncate">{log.url}</td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(log.createdAt).toLocaleString("tr-TR")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <span className="text-sm text-muted-foreground">Page {page}/{totalPages}</span>
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
