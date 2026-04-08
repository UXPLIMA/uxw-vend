"use client";

import { useEffect, useState } from "react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Loader2, FileText, ShoppingBag, UserPlus, Activity } from "lucide-react";

interface FeedItem {
    id: string;
    type: string;
    title: string;
    body: string | null;
    href: string | null;
    icon: string | null;
    createdAt: string;
    actor: { id: string; username: string; avatar: string | null } | null;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    FileText, ShoppingBag, UserPlus, Activity,
};

function relativeTime(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ActivityFeedPage() {
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/activity-feed?limit=50")
            .then((r) => r.json())
            .then((d) => setItems(d.items || []))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Activity className="w-7 h-7" />
                        Activity Feed
                    </h1>
                    <p className="text-muted-foreground">Latest activity across the site</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : items.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">No activity yet.</CardContent></Card>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => {
                            const Icon = ICONS[item.icon || ""] || Activity;
                            return (
                                <Card key={item.id} className="hover:border-primary/50 transition-colors">
                                    <CardContent className="p-3 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-2">
                                                {item.href ? (
                                                    <a href={item.href} className="text-sm text-foreground hover:text-primary truncate">{item.title}</a>
                                                ) : (
                                                    <span className="text-sm text-foreground truncate">{item.title}</span>
                                                )}
                                                <span className="text-[10px] text-muted-foreground flex-shrink-0">{relativeTime(item.createdAt)}</span>
                                            </div>
                                            {item.actor && (
                                                <div className="text-xs text-muted-foreground">{item.actor.username}</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
