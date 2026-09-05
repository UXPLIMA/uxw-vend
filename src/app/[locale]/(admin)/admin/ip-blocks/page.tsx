"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Pagination, usePagedRows } from "@/core/components/ui/pagination";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { Link } from "@/core/lib/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { dateLocaleTag } from "@/core/lib/utils";

interface IpBlock {
    id: string;
    ip: string;
    scope: string;
    reason: string | null;
    expiresAt: string | null;
    createdAt: string;
    createdById: string | null;
}

export default function IpBlocksPage() {
    const __locale = useLocale();
    const __dateTag = dateLocaleTag(__locale);
    const t = useTranslations("admin");
    const commonT = useTranslations("common");

    const [blocks, setBlocks] = useState<IpBlock[]>([]);
    const paged = usePagedRows(blocks);
    const [loading, setLoading] = useState(true);


    const { confirm } = useConfirm();

    const fetchBlocks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/admin/ip-blocks");
            if (res.ok) {
                const data = await res.json();
                setBlocks(data.blocks || []);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBlocks();
    }, [fetchBlocks]);

    const deleteBlock = async (b: IpBlock) => {
        const ok = await confirm({
            title: t("ipBlocks_removeTitle"),
            message: t("ipBlocks_removeConfirm"),
            variant: "danger",
        });
        if (!ok) return;
        const res = await fetch(`/api/v1/admin/ip-blocks/${b.id}`, { method: "DELETE" });
        if (res.ok) {
            toast.success(t("ipBlocks_removed"));
            fetchBlocks();
        } else {
            toast.error(t("ipBlocks_removeFailed"));
        }
    };

    const scopeLabel = (s: string): string => {
        if (s === "admin") return t("ipBlocks_scopeAdmin");
        if (s === "api") return t("ipBlocks_scopeApi");
        return t("ipBlocks_scopeAll");
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("ipBlocks_title")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t("ipBlocks_subtitle")}
                    </p>
                </div>
                <Link href="/admin/ip-blocks/new" className="inline-flex">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" /> {t("ipBlocks_add")}
                    </Button>
                </Link>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : blocks.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {t("ipBlocks_none")}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-muted-foreground border-b">
                                    <tr>
                                        <th className="text-left p-3">{t("ipBlocks_colIp")}</th>
                                        <th className="text-left p-3">{t("ipBlocks_colScope")}</th>
                                        <th className="text-left p-3">{t("ipBlocks_colReason")}</th>
                                        <th className="text-left p-3">{t("ipBlocks_colExpires")}</th>
                                        <th className="text-left p-3">{t("ipBlocks_colCreated")}</th>
                                        <th className="text-right p-3">{t("ipBlocks_colActions")}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {paged.rows.map((b) => {
                                        const expired = b.expiresAt && new Date(b.expiresAt).getTime() < Date.now();
                                        return (
                                            <tr key={b.id}>
                                                <td className="p-3 font-mono">{b.ip}</td>
                                                <td className="p-3">{scopeLabel(b.scope)}</td>
                                                <td className="p-3 text-muted-foreground max-w-xs truncate">
                                                    {b.reason || "-"}
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                    {b.expiresAt ? (
                                                        <span className={expired ? "text-muted-foreground line-through" : ""}>
                                                            {new Date(b.expiresAt).toLocaleString(__dateTag)}
                                                        </span>
                                                    ) : (
                                                        t("ipBlocks_permanent")
                                                    )}
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                    {new Date(b.createdAt).toLocaleDateString(__dateTag)}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Button
                                                        aria-label={commonT("delete")}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive"
                                                        onClick={() => deleteBlock(b)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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
