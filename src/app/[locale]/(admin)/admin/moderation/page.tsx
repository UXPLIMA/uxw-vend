"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import {
    Check,
    X,
    Loader2,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations, useLocale } from "next-intl";

type ModerationType = "blog-comment" | "forum-topic" | "forum-post" | "suggestion";

interface ModerationItem {
    id: string;
    type: ModerationType;
    author: { id: string; username: string } | null;
    preview: string;
    title?: string;
    createdAt: string;
    href?: string;
}

interface CountsPayload {
    counts: Record<ModerationType, number>;
}

interface ListPayload {
    items: ModerationItem[];
    total: number;
    page: number;
    pages: number;
}

const TABS: { key: "all" | ModerationType; labelKey: string }[] = [
    { key: "all", labelKey: "moderation_all" },
    { key: "blog-comment", labelKey: "moderation_blogComment" },
    { key: "forum-topic", labelKey: "moderation_forumTopic" },
    { key: "forum-post", labelKey: "moderation_forumPost" },
    { key: "suggestion", labelKey: "moderation_suggestion" },
];

export default function ModerationPage() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("admin");
    const [activeTab, setActiveTab] = useState<"all" | ModerationType>("all");
    const [counts, setCounts] = useState<Record<ModerationType, number>>({
        "blog-comment": 0,
        "forum-topic": 0,
        "forum-post": 0,
        "suggestion": 0,
    });
    const [items, setItems] = useState<ModerationItem[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    const { confirm } = useConfirm();

    const effectiveTypes = useMemo<ModerationType[]>(() => {
        if (activeTab === "all") return ["blog-comment", "forum-topic", "forum-post", "suggestion"];
        return [activeTab];
    }, [activeTab]);

    const fetchCounts = useCallback(async () => {
        const res = await fetch("/api/v1/admin/moderation");
        if (res.ok) {
            const data: CountsPayload = await res.json();
            setCounts(data.counts);
        }
    }, []);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        setSelected(new Set());
        try {
            if (activeTab === "all") {
                // Fetch first page of each type and concat
                const results = await Promise.all(
                    effectiveTypes.map((t) =>
                        fetch(`/api/v1/admin/moderation?type=${t}&page=1`).then((r) =>
                            r.ok ? (r.json() as Promise<ListPayload>) : null
                        )
                    )
                );
                const combined: ModerationItem[] = [];
                let sum = 0;
                for (const r of results) {
                    if (r) {
                        combined.push(...r.items);
                        sum += r.total;
                    }
                }
                combined.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setItems(combined);
                setTotal(sum);
                setPages(1);
                setPage(1);
            } else {
                const res = await fetch(`/api/v1/admin/moderation?type=${activeTab}&page=${page}`);
                if (res.ok) {
                    const data: ListPayload = await res.json();
                    setItems(data.items);
                    setTotal(data.total);
                    setPages(data.pages);
                }
            }
        } finally {
            setLoading(false);
        }
    }, [activeTab, page, effectiveTypes]);

    useEffect(() => {
        fetchCounts();
    }, [fetchCounts]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === items.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(items.map((i) => i.id)));
        }
    };

    const performAction = async (
        type: ModerationType,
        ids: string[],
        action: "approve" | "reject"
    ) => {
        const res = await fetch("/api/v1/admin/moderation", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ids, type, action }),
        });
        if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            toast.error(data?.error || "Failed");
            return false;
        }
        return true;
    };

    const handleSingle = async (item: ModerationItem, action: "approve" | "reject") => {
        if (action === "reject") {
            const ok = await confirm({
                title: t("moderation_rejectSingleTitle"),
                message: t("moderation_rejectSingleMessage"),
                variant: "danger",
                confirmText: t("moderation_rejectSingle"),
            });
            if (!ok) return;
        }
        setWorking(true);
        try {
            const ok = await performAction(item.type, [item.id], action);
            if (ok) {
                toast.success(action === "approve" ? t("moderation_approvedSingle") : t("moderation_rejectedSingle"));
                await fetchCounts();
                await fetchItems();
            }
        } finally {
            setWorking(false);
        }
    };

    const handleBulk = async (action: "approve" | "reject") => {
        if (selected.size === 0) {
            toast.error(t("moderation_selectAtLeast"));
            return;
        }
        if (action === "reject") {
            const ok = await confirm({
                title: t("moderation_rejectTitle", { count: selected.size }),
                message: t("moderation_rejectMessage"),
                variant: "danger",
                confirmText: t("moderation_rejectAll"),
            });
            if (!ok) return;
        }
        setWorking(true);
        try {
            // Group selected ids by type
            const byType = new Map<ModerationType, string[]>();
            for (const item of items) {
                if (!selected.has(item.id)) continue;
                const list = byType.get(item.type) ?? [];
                list.push(item.id);
                byType.set(item.type, list);
            }
            let totalAffected = 0;
            for (const [type, ids] of byType.entries()) {
                const ok = await performAction(type, ids, action);
                if (ok) totalAffected += ids.length;
            }
            toast.success(action === "approve" ? t("moderation_approved", { count: totalAffected }) : t("moderation_rejected", { count: totalAffected }));
            await fetchCounts();
            await fetchItems();
        } finally {
            setWorking(false);
        }
    };

    const typeLabel = (type: ModerationType): string => {
        switch (type) {
            case "blog-comment":
                return t("moderation_blogComment");
            case "forum-topic":
                return t("moderation_forumTopic");
            case "forum-post":
                return t("moderation_forumPost");
            case "suggestion":
                return t("moderation_suggestion");
        }
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("sidebar_moderationQueue")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t("moderation_description")}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {TABS.map((tab) => {
                    const count =
                        tab.key === "all"
                            ? counts["blog-comment"] +
                              counts["forum-topic"] +
                              counts["forum-post"] +
                              counts["suggestion"]
                            : counts[tab.key];
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            type="button"
                            key={tab.key}
                            onClick={() => {
                                setActiveTab(tab.key);
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground hover:bg-muted/80"
                            }`}
                        >
                            {t(tab.labelKey)}
                            {count > 0 && (
                                <span
                                    className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                                        isActive
                                            ? "bg-primary-foreground/20"
                                            : "bg-background text-foreground"
                                    }`}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <Card>
                <CardContent className="p-0">
                    {items.length > 0 && (
                        <div className="flex items-center gap-3 p-3 border-b bg-muted/40">
                            <input
                                type="checkbox"
                                checked={selected.size === items.length && items.length > 0}
                                onChange={toggleAll}
                                className="w-4 h-4"
                            />
                            <span className="text-xs text-muted-foreground flex-1">
                                {selected.size > 0
                                    ? `${selected.size} selected`
                                    : `${items.length} items`}
                            </span>
                            {selected.size > 0 && (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        disabled={working}
                                        onClick={() => handleBulk("approve")}
                                    >
                                        <Check className="w-3 h-3 mr-1" /> Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={working}
                                        onClick={() => handleBulk("reject")}
                                    >
                                        <X className="w-3 h-3 mr-1" /> Reject
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">
                            {t("moderation_nothingToReview")}
                        </p>
                    ) : (
                        <div className="divide-y">
                            {items.map((item) => (
                                <div key={`${item.type}:${item.id}`} className="p-4 flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(item.id)}
                                        onChange={() => toggleOne(item.id)}
                                        className="w-4 h-4 mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-muted">
                                                {typeLabel(item.type)}
                                            </span>
                                            <span className="font-medium text-sm">
                                                {item.author?.username ?? "anonymous"}
                                            </span>
                                            {item.title && (
                                                <span className="text-xs text-muted-foreground truncate">
                                                    on {item.title}
                                                </span>
                                            )}
                                            {item.href && (
                                                <Link
                                                    href={item.href}
                                                    target="_blank"
                                                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                                >
                                                    <ExternalLink className="w-3 h-3" /> view
                                                </Link>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                            {item.preview}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            {new Date(item.createdAt).toLocaleString("tr-TR")}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={working}
                                            onClick={() => handleSingle(item, "approve")}
                                            title="Approve"
                                        >
                                            <Check className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            disabled={working}
                                            onClick={() => handleSingle(item, "reject")}
                                            title="Reject"
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {pages > 1 && activeTab !== "all" && (
                        <div className="flex items-center justify-between p-3 border-t">
                            <span className="text-xs text-muted-foreground">
                                {total} · Page {page} / {pages}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    <ChevronLeft className="w-3 h-3" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= pages}
                                    onClick={() => setPage(page + 1)}
                                >
                                    <ChevronRight className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
