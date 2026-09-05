"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Pagination, usePagedRows } from "@/core/components/ui/pagination";
import { Loader2, Plus, Trash2, Key } from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { Link } from "@/core/lib/i18n/navigation";
import { dateLocaleTag } from "@/core/lib/utils";
import { writeError } from "@/core/lib/write-result";

interface ApiKeyItem {
    id: string;
    name: string;
    key: string;
    lastUsedAt: string | null;
    isActive: boolean;
    createdAt: string;
}

export default function ApiKeysPage() {
    const __locale = useLocale();
    const __dateTag = dateLocaleTag(__locale);
    const t = useTranslations("admin");
    const commonT = useTranslations("common");
    const [keys, setKeys] = useState<ApiKeyItem[]>([]);
    const paged = usePagedRows(keys);
    const [loading, setLoading] = useState(true);
    const { confirm } = useConfirm();

    const fetchKeys = useCallback(async () => {
        const res = await fetch("/api/v1/api-keys");
        if (res.ok) { const data = await res.json(); setKeys(data.keys || []); }
        setLoading(false);
    }, []);

     
    useEffect(() => { fetchKeys(); }, [fetchKeys]);

    const deleteKey = async (id: string) => {
        const ok = await confirm({ title: t("apiKeys_deleteTitle"), message: t("apiKeys_deleteMessage"), variant: "danger", confirmText: t("common_delete") });
        if (!ok) return;
        const res = await fetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
        const failed = await writeError(res, t("common_writeFailed"), t);
        if (failed) { toast.error(failed); return; }
        fetchKeys();
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("apiKeys_title")}</h1>
                    <p className="text-muted-foreground">{t("apiKeys_subtitle")}</p>
                </div>
                <Link href="/admin/api-keys/new" className="inline-flex">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" /> {t("apiKeys_newKey")}
                    </Button>
                </Link>
            </div>

            <Card>
                <CardContent className="p-0">
                    {keys.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t("apiKeys_noKeys")}</p>
                    ) : (
                        <div className="divide-y">
                            {paged.rows.map((k) => (
                                <div key={k.id} className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <Key className="w-4 h-4 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{k.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{k.key}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">{new Date(k.createdAt).toLocaleDateString(__dateTag)}</span>
                                        <Button aria-label={commonT("delete")} variant="ghost" size="sm" className="text-destructive" onClick={() => deleteKey(k.id)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Pagination
                        page={paged.page}
                        pages={paged.pages}
                        total={paged.total}
                        onPageChange={paged.setPage}
                    />
                </CardContent>
            </Card>
        </>
    );
}
