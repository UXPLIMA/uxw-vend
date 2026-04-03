"use client";

import { useState, useEffect, use } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Loader2, MessageSquare, FileText, ShoppingCart, ThumbsUp, Calendar } from "lucide-react";
import { getMinecraftAvatar } from "@/core/lib/minecraft";

interface Player {
    id: string;
    username: string;
    avatar: string | null;
    createdAt: string;
    role: { name: string; displayName: string; color: string | null } | null;
    _count: { orders: number; topics: number; posts: number; comments: number; suggestions: number };
    recentTopics: { id: string; title: string; slug: string; createdAt: string }[];
    linkedAccounts: { provider: string; username: string | null }[];
}

interface PageProps {
    params: Promise<{ username: string }>;
}

export default function PlayerProfilePage({ params }: PageProps) {
    const { username } = use(params);
    const [player, setPlayer] = useState<Player | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/v1/players/${username}`)
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((d) => { setPlayer(d.player); setLoading(false); })
            .catch(() => setLoading(false));
    }, [username]);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : !player ? (
                    <Card><CardContent className="py-12 text-center text-gray-500">Player not found</CardContent></Card>
                ) : (
                    <>
                        {/* Profile Header */}
                        <div className="flex items-center gap-5 mb-8">
                            <img
                                src={player.avatar || getMinecraftAvatar(player.username, 80)}
                                alt={player.username}
                                className="w-20 h-20 rounded-xl object-cover shadow-sm"
                                onError={(e) => { (e.target as HTMLImageElement).src = getMinecraftAvatar(player.username, 80); }}
                            />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{player.username}</h1>
                                {player.role && (
                                    <span className="text-sm font-medium px-2 py-0.5 rounded mt-1 inline-block" style={{
                                        backgroundColor: (player.role.color || "#6b7280") + "15",
                                        color: player.role.color || "#6b7280",
                                    }}>
                                        {player.role.displayName}
                                    </span>
                                )}
                                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Joined {new Date(player.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                            {[
                                { label: "Orders", value: player._count.orders, icon: ShoppingCart },
                                { label: "Topics", value: player._count.topics, icon: MessageSquare },
                                { label: "Posts", value: player._count.posts, icon: FileText },
                                { label: "Comments", value: player._count.comments, icon: FileText },
                                { label: "Suggestions", value: player._count.suggestions, icon: ThumbsUp },
                            ].map((s) => (
                                <Card key={s.label}>
                                    <CardContent className="p-3 text-center">
                                        <s.icon className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                                        <p className="text-xl font-bold">{s.value}</p>
                                        <p className="text-xs text-gray-500">{s.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Linked Accounts */}
                            {player.linkedAccounts.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-sm">Linked Accounts</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {player.linkedAccounts.map((acc) => (
                                                <div key={acc.provider} className="flex items-center gap-2 text-sm">
                                                    <span className="capitalize font-medium text-gray-700">{acc.provider}</span>
                                                    {acc.username && <span className="text-gray-500">{acc.username}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Recent Topics */}
                            {player.recentTopics.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-sm">Recent Topics</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {player.recentTopics.map((topic) => (
                                                <Link key={topic.id} href={`/forum/topic/${topic.slug}`} className="block text-sm text-gray-700 hover:text-primary transition-colors truncate">
                                                    {topic.title}
                                                </Link>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
