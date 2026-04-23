"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import { useTranslations } from "next-intl";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";
import {
    Search,
    Loader2,
    FileText,
    MessageSquare,
    BookOpen,
    ShoppingBag,
    File,
} from "lucide-react";

interface SearchResult {
    type?: string;
    title: string;
    excerpt?: string;
    href: string;
    image?: string;
}

interface ResultGroup {
    id: string;
    label: string;
    results: SearchResult[];
}

const GROUP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    "blog-search": FileText,
    "forum-search": MessageSquare,
    "help-center-search": BookOpen,
    "store-search": ShoppingBag,
};

function iconFor(groupId: string) {
    return GROUP_ICON[groupId] ?? File;
}

export default function SearchPage() {
    const t = useTranslations("search");
    const params = useSearchParams();
    const initial = params.get("q") || "";
    const [query, setQuery] = useState(initial);
    const [groups, setGroups] = useState<ResultGroup[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const runSearch = async (q: string) => {
        if (q.trim().length < 2) return;
        setLoading(true);
        setSearched(true);
        try {
            const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setGroups(data.groups || []);
            setTotal(data.total || 0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        inputRef.current?.focus();
        if (initial.length >= 2) {
            runSearch(initial);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        runSearch(query);
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("q", query);
            window.history.replaceState(null, "", url.toString());
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <ThemeComponentSlot name="Hero" fallback={() => null} />
            <Navbar />

            <main id="main-content" tabIndex={-1} className="container mx-auto px-4 py-6 flex-1 max-w-6xl">
                <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
                    <Search className="w-7 h-7" />
                    {t("title")}
                </h1>

                <form onSubmit={onSubmit} className="flex gap-2 mb-6 max-w-2xl">
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("placeholder")}
                        className="flex-1"
                        aria-label={t("searchQuery")}
                    />
                    <Button type="submit" disabled={query.trim().length < 2}>{t("searchButton")}</Button>
                </form>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-label={t("loading")} />
                    </div>
                ) : !searched ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            {t("initialHint")}
                        </CardContent>
                    </Card>
                ) : groups.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            {t("noResults", { query })}
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground mb-4">
                            {t("resultsSummary", {
                                total,
                                totalLabel: total !== 1 ? t("results") : t("result"),
                                groups: groups.length,
                                groupsLabel: groups.length !== 1 ? t("sources") : t("source"),
                            })}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                            {groups.map((group) => {
                                const Icon = iconFor(group.id);
                                return (
                                    <Card key={group.id} className="flex flex-col">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base flex items-center justify-between gap-2">
                                                <span className="flex items-center gap-2">
                                                    <Icon className="w-4 h-4 text-primary" />
                                                    {group.label}
                                                </span>
                                                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                                    {group.results.length}
                                                </span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-1 flex-1">
                                            {group.results.map((r, i) => (
                                                <a
                                                    key={`${group.id}-${i}`}
                                                    href={r.href}
                                                    className="block p-3 -mx-3 rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        {r.image && (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={r.image}
                                                                alt=""
                                                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                                                            />
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium text-foreground truncate">{r.title}</div>
                                                            {r.excerpt && (
                                                                <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                                                    {r.excerpt}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </a>
                                            ))}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </>
                )}
            </main>

            <Footer />
        </div>
    );
}
