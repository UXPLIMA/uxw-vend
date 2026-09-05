"use client";

import { useEffect, useState } from "react";
import { Award, Check, Loader2, Users } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Footer, Navbar } from "@/core/sdk/layout";
import { LoadFailed } from "@/core/sdk/ui";
import { ThemeComponentSlot } from "@/core/sdk/theme";

interface TrophyRow {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    points: number;
    _count: { users: number };
}

interface EarnedRow {
    id: string;
    trophy: { id: string };
}

export default function PublicTrophiesPage() {
    const t = useTranslations("trophies");
    const { data: session } = useSession();
    const [trophies, setTrophies] = useState<TrophyRow[]>([]);
    const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const tasks: Promise<unknown>[] = [
            fetch("/api/v1/trophies")
                .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
                .then((d) => {
                    if (cancelled) return;
                    setTrophies(Array.isArray(d.trophies) ? d.trophies : []);
                }),
        ];
        if (session?.user) {
            tasks.push(
                fetch("/api/v1/me/trophies")
                    .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
                    .then((d) => {
                        if (cancelled) return;
                        const arr: EarnedRow[] = Array.isArray(d.earned) ? d.earned : [];
                        setEarnedIds(new Set(arr.map((row) => row.trophy.id)));
                    }),
            );
        }
        Promise.all(tasks)
            .then(() => { if (!cancelled) setFailed(false); })
            .catch(() => { if (!cancelled) setFailed(true); })
            .finally(() => {
                if (cancelled) return;
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [session, reloadKey]);

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-5xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Award className="w-7 h-7 text-amber-500" />
                        {t("pageTitle")}
                    </h1>
                    <p className="text-muted-foreground">{t("pageDesc")}</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : failed ? (
                    <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
                ) : trophies.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        {t("noTrophiesAvailable")}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {trophies.map((tr) => {
                            const earned = earnedIds.has(tr.id);
                            return (
                                <div
                                    key={tr.id}
                                    className={`relative rounded-lg border p-4 transition-colors ${earned ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
                                        }`}
                                >
                                    {earned && (
                                        <span
                                            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-green-500/15 text-green-600 text-xs px-2 py-0.5"
                                            title={t("earnedTitle")}
                                        >
                                            <Check className="w-3 h-3" /> {t("earned")}
                                        </span>
                                    )}
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
                                            style={{ backgroundColor: tr.color || "#6366f1" }}
                                        >
                                            <Award className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h2 className="font-semibold truncate">{tr.name}</h2>
                                            {tr.description && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {tr.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                                    {t("pointsShort", { points: tr.points })}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {tr._count.users}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
