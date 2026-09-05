"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
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
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const [ip, setIp] = useState("");
    const [scope, setScope] = useState<"all" | "admin" | "api">("all");
    const [reason, setReason] = useState("");
    const [expiresAt, setExpiresAt] = useState("");

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

    const resetForm = () => {
        setShowForm(false);
        setIp("");
        setScope("all");
        setReason("");
        setExpiresAt("");
    };

    const createBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ip.trim()) {
            toast.error(t("ipBlocks_ipRequired"));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/ip-blocks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ip: ip.trim(),
                    scope,
                    reason: reason.trim() || null,
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                }),
            });
            if (res.ok) {
                toast.success(t("ipBlocks_created"));
                resetForm();
                fetchBlocks();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t("ipBlocks_createFailed"));
            }
        } finally {
            setSaving(false);
        }
    };

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
                <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
                    {showForm ? (
                        <>
                            <X className="w-4 h-4 mr-2" /> {t("ipBlocks_cancel")}
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4 mr-2" /> {t("ipBlocks_add")}
                        </>
                    )}
                </Button>
            </div>

            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{t("ipBlocks_newTitle")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={createBlock} className="space-y-4">
                            <div>
                                <Label>{t("ipBlocks_ipLabel")}</Label>
                                <Input
                                    aria-label={t("ipBlocks_ipLabel")}
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    placeholder="1.2.3.4 or 192.168.0.0/24"
                                    autoComplete="off"
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t("ipBlocks_ipHint")}
                                </p>
                            </div>
                            <div>
                                <Label>{t("ipBlocks_scope")}</Label>
                                <select
                                    aria-label={t("ipBlocks_scope")}
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value as "all" | "admin" | "api")}
                                    className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                                >
                                    <option value="all">{t("ipBlocks_scopeAll")}</option>
                                    <option value="admin">{t("ipBlocks_scopeAdmin")}</option>
                                    <option value="api">{t("ipBlocks_scopeApi")}</option>
                                </select>
                            </div>
                            <div>
                                <Label>{t("ipBlocks_reason")}</Label>
                                <Input
                                    aria-label={t("ipBlocks_reason")}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder={t("ipBlocks_reasonPlaceholder")}
                                />
                            </div>
                            <div>
                                <Label>{t("ipBlocks_expiresAt")}</Label>
                                <Input
                                    aria-label={t("ipBlocks_expiresAt")}
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t("ipBlocks_expiresHint")}
                                </p>
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {t("ipBlocks_saving")}
                                    </>
                                ) : (
                                    t("ipBlocks_save")
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

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
                                    {blocks.map((b) => {
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
                </CardContent>
            </Card>
        </>
    );
}
