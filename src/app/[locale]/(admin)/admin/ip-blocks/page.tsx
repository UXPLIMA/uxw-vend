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
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("admin");
    const fallback = (key: string, en: string) => (t.has(key) ? t(key) : en);

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
            toast.error(fallback("ipBlocks_ipRequired", "IP address is required."));
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
                toast.success(fallback("ipBlocks_created", "IP blocked."));
                resetForm();
                fetchBlocks();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || fallback("ipBlocks_createFailed", "Failed to create block."));
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteBlock = async (b: IpBlock) => {
        const ok = await confirm({
            title: fallback("ipBlocks_removeTitle", "Remove block"),
            message: fallback("ipBlocks_removeConfirm", "Unblock this IP? It will regain access immediately."),
            variant: "danger",
        });
        if (!ok) return;
        const res = await fetch(`/api/v1/admin/ip-blocks/${b.id}`, { method: "DELETE" });
        if (res.ok) {
            toast.success(fallback("ipBlocks_removed", "IP unblocked."));
            fetchBlocks();
        } else {
            toast.error(fallback("ipBlocks_removeFailed", "Failed to remove block."));
        }
    };

    const scopeLabel = (s: string): string => {
        if (s === "admin") return fallback("ipBlocks_scopeAdmin", "Admin only");
        if (s === "api") return fallback("ipBlocks_scopeApi", "API only");
        return fallback("ipBlocks_scopeAll", "Entire site");
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold">
                        {fallback("ipBlocks_title", "IP Blocks")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {fallback(
                            "ipBlocks_subtitle",
                            "Ban specific IPs or CIDR ranges from accessing the site or admin panel.",
                        )}
                    </p>
                </div>
                <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
                    {showForm ? (
                        <>
                            <X className="w-4 h-4 mr-2" /> {fallback("ipBlocks_cancel", "Cancel")}
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4 mr-2" /> {fallback("ipBlocks_add", "Block IP")}
                        </>
                    )}
                </Button>
            </div>

            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{fallback("ipBlocks_newTitle", "New block")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={createBlock} className="space-y-4">
                            <div>
                                <Label>{fallback("ipBlocks_ipLabel", "IP or CIDR")}</Label>
                                <Input
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    placeholder="1.2.3.4 or 192.168.0.0/24"
                                    autoComplete="off"
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {fallback(
                                        "ipBlocks_ipHint",
                                        "Enter a single IPv4 address or an IPv4 CIDR range.",
                                    )}
                                </p>
                            </div>
                            <div>
                                <Label>{fallback("ipBlocks_scope", "Scope")}</Label>
                                <select
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value as "all" | "admin" | "api")}
                                    className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                                >
                                    <option value="all">{fallback("ipBlocks_scopeAll", "Entire site")}</option>
                                    <option value="admin">{fallback("ipBlocks_scopeAdmin", "Admin only")}</option>
                                    <option value="api">{fallback("ipBlocks_scopeApi", "API only")}</option>
                                </select>
                            </div>
                            <div>
                                <Label>{fallback("ipBlocks_reason", "Reason (optional)")}</Label>
                                <Input
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder={fallback("ipBlocks_reasonPlaceholder", "Abuse, spam, ...")}
                                />
                            </div>
                            <div>
                                <Label>{fallback("ipBlocks_expiresAt", "Expires at (optional)")}</Label>
                                <Input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {fallback("ipBlocks_expiresHint", "Leave empty for a permanent block.")}
                                </p>
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {fallback("ipBlocks_saving", "Saving...")}
                                    </>
                                ) : (
                                    fallback("ipBlocks_save", "Block IP")
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
                            {fallback("ipBlocks_none", "No IPs are currently blocked.")}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-muted-foreground border-b">
                                    <tr>
                                        <th className="text-left p-3">{fallback("ipBlocks_colIp", "IP / CIDR")}</th>
                                        <th className="text-left p-3">{fallback("ipBlocks_colScope", "Scope")}</th>
                                        <th className="text-left p-3">{fallback("ipBlocks_colReason", "Reason")}</th>
                                        <th className="text-left p-3">{fallback("ipBlocks_colExpires", "Expires")}</th>
                                        <th className="text-left p-3">{fallback("ipBlocks_colCreated", "Created")}</th>
                                        <th className="text-right p-3">{fallback("ipBlocks_colActions", "Actions")}</th>
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
                                                    {b.reason || "—"}
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                    {b.expiresAt ? (
                                                        <span className={expired ? "text-muted-foreground line-through" : ""}>
                                                            {new Date(b.expiresAt).toLocaleString("tr-TR")}
                                                        </span>
                                                    ) : (
                                                        fallback("ipBlocks_permanent", "Permanent")
                                                    )}
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                    {new Date(b.createdAt).toLocaleDateString("tr-TR")}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Button
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
