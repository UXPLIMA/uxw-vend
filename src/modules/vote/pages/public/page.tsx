"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, ExternalLink, Gift } from "lucide-react";
import { toast } from "sonner";

interface VoteSite {
    id: string;
    name: string;
    url: string;
    reward: number;
    icon: string | null;
    _count: { votes: number };
}

export default function VotePage() {
    const { data: session } = useSession();
    const [sites, setSites] = useState<VoteSite[]>([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/v1/vote")
            .then((r) => r.json())
            .then((d) => { setSites(d.sites || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const claimReward = async (siteId: string) => {
        setClaiming(siteId);
        const res = await fetch("/api/v1/vote/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voteSiteId: siteId }),
        });
        const data = await res.json();
        if (res.ok) toast.success(data.message);
        else toast.error(data.error);
        setClaiming(null);
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Vote for Us</h1>
                    <p className="text-gray-500">Vote on these sites and earn credit rewards!</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : sites.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-gray-500">No vote sites configured</CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {sites.map((site) => (
                            <Card key={site.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                                        {site.icon || "🗳️"}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium">{site.name}</h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                            <span>{site._count.votes} total votes</span>
                                            {site.reward > 0 && (
                                                <span className="flex items-center gap-1 text-green-600">
                                                    <Gift className="w-3 h-3" /> {site.reward} credits
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <a href={site.url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="sm">
                                                <ExternalLink className="w-3 h-3 mr-1" /> Vote
                                            </Button>
                                        </a>
                                        {session?.user && site.reward > 0 && (
                                            <Button size="sm" onClick={() => claimReward(site.id)} disabled={claiming === site.id}>
                                                {claiming === site.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
