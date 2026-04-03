"use client";

import { useState, useEffect } from "react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Trophy, Crown, Medal } from "lucide-react";
import { useCurrency } from "@/core/lib/currency/context";

interface LeaderEntry {
    username: string;
    avatar: string | null;
    value: number;
    count?: number;
}

const tabs = [
    { id: "buyers", label: "Top Buyers", icon: Crown },
    { id: "voters", label: "Top Voters", icon: Medal },
    { id: "forum", label: "Forum Contributors", icon: Trophy },
];

const rankColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];

export default function LeaderboardPage() {
    const [activeTab, setActiveTab] = useState("buyers");
    const [entries, setEntries] = useState<LeaderEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { formatPrice } = useCurrency();

    useEffect(() => {
        setLoading(true);
        fetch(`/api/v1/leaderboard?type=${activeTab}&limit=20`)
            .then((r) => r.json())
            .then((d) => { setEntries(d.leaderboard || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [activeTab]);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Leaderboard</h1>
                    <p className="text-gray-500">Top community members</p>
                </div>

                <div className="flex justify-center gap-2 mb-6">
                    {tabs.map((tab) => (
                        <Button key={tab.id} variant={activeTab === tab.id ? "default" : "outline"} onClick={() => setActiveTab(tab.id)}>
                            <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
                        </Button>
                    ))}
                </div>

                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                        ) : entries.length === 0 ? (
                            <p className="text-gray-500 text-center py-12">No data yet</p>
                        ) : (
                            <div className="divide-y">
                                {entries.map((entry, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4">
                                        <div className={`w-8 text-center font-bold text-lg ${rankColors[i] || "text-gray-400"}`}>
                                            {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-sm overflow-hidden">
                                            {entry.avatar ? (
                                                <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                entry.username[0].toUpperCase()
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{entry.username}</p>
                                        </div>
                                        <div className="text-right font-bold">
                                            {activeTab === "buyers" ? formatPrice(entry.value) : entry.value}
                                            <span className="text-xs text-gray-400 ml-1">
                                                {activeTab === "buyers" ? "spent" : activeTab === "voters" ? "votes" : "posts"}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
