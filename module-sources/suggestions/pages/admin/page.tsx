"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Trash2, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface Suggestion {
    id: string;
    title: string;
    content: string;
    status: string;
    upvotes: number;
    createdAt: string;
    author?: { username: string | null } | null;
}

const STATUS_OPTIONS = ["open", "underReview", "planned", "inProgress", "completed", "declined"];
const FILTERS: { key: "all" | "open" | "planned" | "completed" | "declined"; statusMatch?: string }[] = [
    { key: "all" },
    { key: "open", statusMatch: "open" },
    { key: "planned", statusMatch: "planned" },
    { key: "completed", statusMatch: "completed" },
    { key: "declined", statusMatch: "declined" },
];

const statusBadgeClass = (status: string) => {
    switch (status) {
        case "completed": return "bg-green-100 text-green-700";
        case "planned":
        case "inProgress": return "bg-blue-100 text-blue-700";
        case "declined": return "bg-red-100 text-red-700";
        case "underReview": return "bg-yellow-100 text-yellow-700";
        default: return "bg-muted text-muted-foreground";
    }
};

export default function AdminSuggestionsPage() {
    const t = useTranslations("suggestions");
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const { confirm } = useConfirm();
    const [items, setItems] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "open" | "planned" | "completed" | "declined">("all");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/suggestions?limit=200");
            const data = await res.json();
            setItems(data.suggestions || []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const changeStatus = async (id: string, status: string) => {
        try {
            const res = await fetch(`/api/v1/suggestions/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error("failed");
            toast.success(t("adm_statusChangedToast"));
            await load();
        } catch {
            toast.error(t("adm_error"));
        }
    };

    const remove = async (id: string) => {
        if (!(await confirm({
            title: t("adm_delete"),
            message: t("adm_deleteConfirm"),
            confirmText: t("adm_delete"),
            variant: "danger",
        }))) return;
        try {
            const res = await fetch(`/api/v1/suggestions/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("failed");
            toast.success(t("adm_deletedToast"));
            await load();
        } catch {
            toast.error(t("adm_error"));
        }
    };

    const filtered = items.filter(s => {
        const match = FILTERS.find(f => f.key === filter);
        if (!match || !match.statusMatch) return true;
        return s.status === match.statusMatch;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t("adm_title")}</h1>
                <p className="text-muted-foreground">{t("adm_subtitle")}</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {FILTERS.map(f => (
                    <Button
                        key={f.key}
                        variant={filter === f.key ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f.key)}
                    >
                        {t(`adm_filter${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`)}
                    </Button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {t("adm_empty")}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map(s => (
                        <Card key={s.id}>
                            <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                                <div className="flex flex-col items-center justify-center min-w-16 px-2 py-1 rounded bg-muted">
                                    <ThumbsUp className="w-4 h-4 text-muted-foreground mb-1" />
                                    <span className="text-lg font-bold">{s.upvotes}</span>
                                    <span className="text-[10px] text-muted-foreground">{t("votes")}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-2 mb-1">
                                        <h3 className="font-semibold flex-1">{s.title}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(s.status)}`}>
                                            {STATUS_OPTIONS.includes(s.status) ? t(s.status) : s.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{s.content}</p>
                                    <div className="text-xs text-muted-foreground">
                                        {t("submittedBy")} {s.author?.username || t("deletedUser")} · {new Date(s.createdAt).toLocaleDateString(__dateTag)}
                                    </div>
                                </div>
                                <div className="flex md:flex-col gap-2 items-end">
                                    <select
                                        className="border border-input bg-background rounded-md h-9 px-2 text-sm"
                                        value={s.status}
                                        onChange={e => changeStatus(s.id, e.target.value)}
                                        aria-label={t("adm_setStatus")}
                                    >
                                        {STATUS_OPTIONS.map(o => (
                                            <option key={o} value={o}>{t(o)}</option>
                                        ))}
                                    </select>
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(s.id)}>
                                        <Trash2 className="w-4 h-4 mr-1" /> {t("adm_delete")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
