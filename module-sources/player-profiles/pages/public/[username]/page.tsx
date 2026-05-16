"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Loader2, MessageSquare, FileText, ShoppingCart, ThumbsUp, Calendar } from "lucide-react";
import { getMinecraftAvatar } from "../../../lib/minecraft";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

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
    const t = useTranslations("playerProfiles");
    const [player, setPlayer] = useState<Player | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/v1/players/${username}`)
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((d) => { setPlayer(d.player); setLoading(false); })
            .catch(() => setLoading(false));
    }, [username]);

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <Navbar />
            <ThemeComponentSlot name="Hero" />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : !player ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">{t("playerNotFound")}</CardContent></Card>
                ) : (
                    <>
                        {/* Profile Header */}
                        <div className="flex items-center gap-5 mb-8">
                            <Image
                                src={player.avatar || getMinecraftAvatar(player.username, 80)}
                                alt={player.username}
                                width={80}
                                height={80}
                                className="w-20 h-20 rounded-xl object-cover shadow-sm"
                                onError={(e) => { (e.target as HTMLImageElement).src = getMinecraftAvatar(player.username, 80); }}
                            />
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">{player.username}</h1>
                                {player.role && (
                                    <span className="text-sm font-medium px-2 py-0.5 rounded mt-1 inline-block" style={{
                                        backgroundColor: (player.role.color || "#6b7280") + "15",
                                        color: player.role.color || "#6b7280",
                                    }}>
                                        {player.role.displayName}
                                    </span>
                                )}
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {t("joinDate")}: {new Date(player.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                            {[
                                { label: t("statistics"), value: player._count.orders, icon: ShoppingCart },
                                { label: t("activity"), value: player._count.topics, icon: MessageSquare },
                                { label: t("badges"), value: player._count.posts, icon: FileText },
                                { label: t("rank"), value: player._count.comments, icon: FileText },
                                { label: t("playtime"), value: player._count.suggestions, icon: ThumbsUp },
                            ].map((s) => (
                                <Card key={s.label}>
                                    <CardContent className="p-3 text-center">
                                        <s.icon className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                                        <p className="text-xl font-bold">{s.value}</p>
                                        <p className="text-xs text-muted-foreground">{s.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Linked Accounts */}
                            {player.linkedAccounts.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-sm">{t("linkedAccounts")}</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {player.linkedAccounts.map((acc) => (
                                                <div key={acc.provider} className="flex items-center gap-2 text-sm">
                                                    <span className="capitalize font-medium text-foreground">{acc.provider}</span>
                                                    {acc.username && <span className="text-muted-foreground">{acc.username}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Recent Topics */}
                            {player.recentTopics.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-sm">{t("activity")}</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {player.recentTopics.map((topic) => (
                                                <Link key={topic.id} href={`/forum/topic/${topic.id}/${topic.slug}`} className="block text-sm text-foreground hover:text-primary transition-colors truncate">
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

            <Footer />
        </div>
    );
}
