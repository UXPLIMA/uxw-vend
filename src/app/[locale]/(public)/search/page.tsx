"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import { Search, Loader2 } from "lucide-react";

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

export default function SearchPage() {
    const params = useSearchParams();
    const initial = params.get("q") || "";
    const [query, setQuery] = useState(initial);
    const [groups, setGroups] = useState<ResultGroup[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

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

    // Auto-run if landing with ?q=
    useEffect(() => {
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
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
                    <Search className="w-7 h-7" />
                    Search
                </h1>

                <form onSubmit={onSubmit} className="flex gap-2 mb-6">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search the site..."
                        className="flex-1"
                    />
                    <Button type="submit">Search</Button>
                </form>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : !searched ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">
                        Type at least 2 characters to search across all installed modules.
                    </CardContent></Card>
                ) : groups.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">
                        No results for &ldquo;{query}&rdquo;
                    </CardContent></Card>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground mb-4">{total} result{total !== 1 ? "s" : ""}</p>
                        <div className="space-y-6">
                            {groups.map((group) => (
                                <Card key={group.id}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{group.label}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1">
                                        {group.results.map((r, i) => (
                                            <a
                                                key={`${group.id}-${i}`}
                                                href={r.href}
                                                className="block p-3 -mx-3 rounded-md hover:bg-muted transition-colors"
                                            >
                                                <div className="font-medium text-foreground">{r.title}</div>
                                                {r.excerpt && (
                                                    <div className="text-sm text-muted-foreground line-clamp-2">{r.excerpt}</div>
                                                )}
                                            </a>
                                        ))}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
