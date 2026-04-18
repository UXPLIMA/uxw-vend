"use client";

import { useState, useEffect } from "react";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Loader2 } from "lucide-react";

interface Entry {
    id: string;
    version: string;
    title: string;
    content: string;
    type: string;
    color?: string | null;
    createdAt: string;
}

export default function ChangelogPage() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/changelog")
            .then((r) => r.json())
            .then((d) => { setEntries(d.entries || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <HeroBanner />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <h1 className="text-3xl font-bold text-foreground mb-2">Changelog</h1>
                <p className="text-muted-foreground mb-8">Latest updates and improvements</p>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : entries.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">No changelog entries yet</CardContent></Card>
                ) : (
                    <div className="relative">
                        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />
                        <div className="space-y-6">
                            {entries.map((entry) => {
                                return (
                                    <div key={entry.id} className="relative pl-12">
                                        <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center z-10">
                                            <span className="text-xs font-bold text-muted-foreground">v</span>
                                        </div>
                                        <Card>
                                            <CardContent className="p-5">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span
                                                        className="text-xs px-2 py-0.5 rounded font-medium text-white"
                                                        style={{ backgroundColor: entry.color || "#3b82f6" }}
                                                    >
                                                        {entry.type}
                                                    </span>
                                                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">
                                                        v{entry.version}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(entry.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-foreground mb-2">{entry.title}</h3>
                                                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.content}</div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
