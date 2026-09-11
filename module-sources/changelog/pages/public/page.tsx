"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { changelogTone, changelogTypeLabel } from "../../lib/types";
import { entryHref } from "../../lib/entry-page";
import { Link } from "@/core/sdk/navigation";
import { Badge, Card, CardContent, LoadFailed, Pagination, RichContent, usePagedRows } from "@/core/sdk/ui";
import { PageFrame } from "@/core/sdk/layout";
import { useLocalDate } from "@/core/sdk/ui";
import { Loader2 } from "lucide-react";

interface Entry {
    id: string;
    number: number;
    slug: string;
    hasDetails?: boolean;
    version: string;
    title: string;
    content: string;
    type: string;
    color?: string | null;
    createdAt: string;
}

export default function ChangelogPage() {
    const t = useTranslations('changelog');
    const formatLocalDate = useLocalDate();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const paged = usePagedRows(entries, 10);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/changelog")
            .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then((d) => { if (cancelled) return; setEntries(d.entries || []); setFailed(false); setLoading(false); })
            .catch(() => { if (cancelled) return; setFailed(true); setLoading(false); });
        return () => { cancelled = true; };
    }, [reloadKey]);

    return (
        <PageFrame
            title={t('title')}
            description={t('subtitle')}
        >
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : failed ? (
                <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
            ) : entries.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">{t('empty')}</CardContent></Card>
            ) : (
                <div>
                    {/* The rail is drawn inside the list, not around the whole
                        block. Spanning the outer container ran it down through
                        the pagination underneath, so the line crossed the row
                        count and the page numbers. */}
                    <div className="relative">
                        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />
                        <div className="space-y-6">
                        {paged.rows.map((entry) => {
                            const href = entry.hasDetails ? entryHref({ ...entry, details: "x" }) : null;
                            return (
                                <div key={entry.id} className="relative pl-12">
                                    {/* The marker read "v" on every release,
                                        which told a reader nothing the shape of
                                        the page had not already said. */}
                                    <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center z-10">
                                        <span className="text-[11px] font-bold text-foreground tabular-nums">
                                            {entry.version.split(".").slice(0, 2).join(".")}
                                        </span>
                                    </div>
                                    <Card>
                                        <CardContent className="p-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge tone={changelogTone(entry.type)}>
                                                    {changelogTypeLabel(t, entry.type)}
                                                </Badge>
                                                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">
                                                    v{entry.version}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatLocalDate(entry.createdAt)}
                                                </span>
                                            </div>
                                            {/* A link only where there is
                                                something behind it. A title
                                                that leads to a copy of the line
                                                below teaches a reader the links
                                                here are not worth following. */}
                                            {href ? (
                                                <h2 className="font-bold text-foreground mb-2">
                                                    <Link href={href} className="hover:text-primary transition-colors">
                                                        {entry.title}
                                                    </Link>
                                                </h2>
                                            ) : (
                                                <h2 className="font-bold text-foreground mb-2">{entry.title}</h2>
                                            )}
                                            <RichContent
                                                className="text-sm text-muted-foreground"
                                                html={entry.content}
                                            />
                                            {href && (
                                                <Link
                                                    href={href}
                                                    className="mt-3 inline-flex text-sm text-primary hover:underline"
                                                >
                                                    {t("readMore")}
                                                </Link>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })}
                        </div>
                    </div>
                    {paged.pages > 1 && (
                        <Pagination className="mt-6" page={paged.page} pages={paged.pages} total={paged.total} onPageChange={paged.setPage} />
                    )}
                </div>
            )}
        </PageFrame>
    );
}
