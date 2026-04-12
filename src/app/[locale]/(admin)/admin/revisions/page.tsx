"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
    Loader2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface Revision {
    id: string;
    resource: string;
    resourceId: string;
    action: string;
    data: unknown;
    createdAt: string;
    author: { id: string; username: string } | null;
}

interface RevisionsResponse {
    revisions: Revision[];
    total: number;
    page: number;
    pages: number;
    resources: string[];
}

export default function RevisionsPage() {
    const t = useTranslations("admin");
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [resources, setResources] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [resourceFilter, setResourceFilter] = useState("");
    const [resourceIdFilter, setResourceIdFilter] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const fetchRevisions = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            if (resourceFilter) params.set("resource", resourceFilter);
            if (resourceIdFilter) params.set("resourceId", resourceIdFilter);
            const res = await fetch(`/api/v1/admin/revisions?${params.toString()}`);
            if (res.ok) {
                const data: RevisionsResponse = await res.json();
                setRevisions(data.revisions || []);
                setPages(data.pages || 1);
                setTotal(data.total || 0);
                if (data.resources && data.resources.length > 0) {
                    setResources(data.resources);
                }
            }
        } finally {
            setLoading(false);
        }
    }, [page, resourceFilter, resourceIdFilter]);

    useEffect(() => {
        fetchRevisions();
    }, [fetchRevisions]);

    const toggleExpand = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const actionBadge = (action: string) => {
        const cls =
            action === "delete"
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${cls}`}>
                {action}
            </span>
        );
    };

    const fallback = (key: string, en: string) => (t.has(key) ? t(key) : en);

    return (
        <>
            <div className="mb-6">
                <h1 className="text-xl font-semibold">
                    {fallback("revisions_title", "Revision History")}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {fallback(
                        "revisions_subtitle",
                        "Audit trail of every content update and delete across modules.",
                    )}
                </p>
            </div>

            <Card className="mb-4">
                <CardContent className="p-4 grid md:grid-cols-3 gap-3">
                    <div>
                        <Label>{fallback("revisions_filterResource", "Resource")}</Label>
                        <select
                            value={resourceFilter}
                            onChange={(e) => {
                                setPage(1);
                                setResourceFilter(e.target.value);
                            }}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="">{fallback("revisions_allResources", "All resources")}</option>
                            {resources.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label>{fallback("revisions_filterResourceId", "Resource ID")}</Label>
                        <Input
                            value={resourceIdFilter}
                            onChange={(e) => {
                                setPage(1);
                                setResourceIdFilter(e.target.value);
                            }}
                            placeholder={fallback("revisions_resourceIdPlaceholder", "Optional entity ID")}
                        />
                    </div>
                    <div className="flex items-end text-sm text-muted-foreground">
                        {total} {fallback("revisions_totalSuffix", "revisions")}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : revisions.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {fallback("revisions_none", "No revisions recorded yet.")}
                        </p>
                    ) : (
                        <div className="divide-y">
                            {revisions.map((rev) => {
                                const isOpen = expanded.has(rev.id);
                                return (
                                    <div key={rev.id} className="hover:bg-muted/30">
                                        <button
                                            type="button"
                                            onClick={() => toggleExpand(rev.id)}
                                            className="w-full flex items-center gap-3 p-4 text-left"
                                        >
                                            {isOpen ? (
                                                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            ) : (
                                                <ChevronRightIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                                                <span className="font-mono text-xs truncate" title={rev.resource}>
                                                    {rev.resource}
                                                </span>
                                                <span
                                                    className="font-mono text-xs text-muted-foreground truncate"
                                                    title={rev.resourceId}
                                                >
                                                    {rev.resourceId.length > 12
                                                        ? `${rev.resourceId.slice(0, 12)}…`
                                                        : rev.resourceId}
                                                </span>
                                                <span>{actionBadge(rev.action)}</span>
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {rev.author?.username || fallback("revisions_system", "system")}
                                                </span>
                                                <span className="text-xs text-muted-foreground text-right md:text-left">
                                                    {new Date(rev.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </button>
                                        {isOpen && (
                                            <div className="px-10 pb-4">
                                                <pre className="font-mono text-xs bg-muted/50 border rounded p-3 overflow-x-auto max-h-96">
                                                    {JSON.stringify(rev.data, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {pages > 1 && (
                        <div className="flex items-center justify-between p-3 border-t">
                            <span className="text-xs text-muted-foreground">
                                {fallback("revisions_page", "Page")} {page} / {pages}
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
