"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Trophy, Crown, Medal } from "lucide-react";
// Minecraft avatar helper - inline
function getMinecraftAvatar(username: string, size = 64) { return `https://mc-heads.net/avatar/${username}/${size}`; }
import { useCurrency } from "../../lib/currency-context";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface LeaderEntry {
    username: string;
    avatar: string | null;
    value: number;
    count?: number;
}

const rankColors = ["text-yellow-500", "text-muted-foreground", "text-amber-600"];

export default function LeaderboardPage() {
    const t = useTranslations("leaderboard");
    const [activeTab, setActiveTab] = useState("buyers");
    const [entries, setEntries] = useState<LeaderEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { formatPrice } = useCurrency();

    const tabs = [
        { id: "buyers", label: t("topBuyers"), icon: Crown },
        { id: "voters", label: t("topVoters"), icon: Medal },
        { id: "forum", label: t("mostActive"), icon: Trophy },
    ];

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        fetch(`/api/v1/leaderboard?type=${activeTab}&limit=20`)
            .then((r) => r.json())
            .then((d) => { setEntries(d.leaderboard || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [activeTab]);

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" fallback={() => null} />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
                    <p className="text-muted-foreground">{t("rank")}</p>
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
                            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                        ) : entries.length === 0 ? (
                            <p className="text-muted-foreground text-center py-12">{t("noData")}</p>
                        ) : (
                            <div className="divide-y">
                                {entries.map((entry, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4">
                                        <div className={`w-8 text-center font-bold text-lg ${rankColors[i] || "text-muted-foreground"}`}>
                                            #{i + 1}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-sm overflow-hidden">
                                            <Image
                                                src={entry.avatar || getMinecraftAvatar(entry.username, 40)}
                                                alt={entry.username}
                                                width={40}
                                                height={40}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{entry.username}</p>
                                        </div>
                                        <div className="text-right font-bold">
                                            {activeTab === "buyers" ? formatPrice(entry.value) : entry.value}
                                            <span className="text-xs text-muted-foreground ml-1">
                                                {activeTab === "buyers" ? t("totalSpent").toLowerCase() : activeTab === "voters" ? t("votes").toLowerCase() : t("activity").toLowerCase()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>

            <Footer />
        </div>
    );
}
