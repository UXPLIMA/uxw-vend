"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, LoadFailed, Pagination, usePagedRows } from "@/core/sdk/ui";
import { PageFrame } from "@/core/sdk/layout";
import { Loader2, Download, FileText } from "lucide-react";

interface DownloadItem {
    id: string;
    title: string;
    description: string | null;
    fileName: string;
    fileSize: number | null;
    downloads: number;
    createdAt: string;
}

function formatFileSize(bytes: number | null, unknownLabel: string): string {
    if (!bytes) return unknownLabel;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DownloadsPage() {
    const t = useTranslations('downloads');
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const paged = usePagedRows(downloads, 10);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/downloads")
            .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then((d) => { if (cancelled) return; setDownloads(d.downloads || []); setFailed(false); setLoading(false); })
            .catch(() => { if (cancelled) return; setFailed(true); setLoading(false); });
        return () => { cancelled = true; };
    }, [reloadKey]);

    const handleDownload = async (id: string) => {
        const res = await fetch(`/api/v1/downloads/${id}`);
        if (res.ok) {
            const data = await res.json();
            window.open(data.url, "_blank");
            // Update count locally
            setDownloads((prev) => prev.map((d) => d.id === id ? { ...d, downloads: d.downloads + 1 } : d));
        }
    };

    return (
        <PageFrame
            title={t('title')}
            description={t('subtitle')}
        >
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : failed ? (
                <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
            ) : downloads.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">{t('empty')}</CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {paged.rows.map((dl) => (
                        <Card key={dl.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-medium text-foreground">{dl.title}</h2>
                                    {dl.description && <p className="text-sm text-muted-foreground line-clamp-1">{dl.description}</p>}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                        <span>{dl.fileName}</span>
                                        <span>{formatFileSize(dl.fileSize, t('unknownSize'))}</span>
                                        <span>{t('downloadsCount', { count: dl.downloads })}</span>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => handleDownload(dl.id)}>
                                    <Download className="w-4 h-4" /> {t('downloadAction')}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                    {paged.pages > 1 && (
                        <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPageChange={paged.setPage} />
                    )}
                </div>
            )}
        </PageFrame>
    );
}
