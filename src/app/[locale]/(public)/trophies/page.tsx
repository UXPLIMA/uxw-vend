import type { Metadata } from "next";
import { Award, Check, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { prisma } from "@/core/lib/db";
import { auth } from "@/core/lib/auth";
import { buildPageMeta } from "@/core/lib/seo";
import { cached } from "@/core/lib/cache";

const TROPHIES_PUBLIC_CACHE_KEY = "trophies:public";
const TROPHIES_PUBLIC_TTL_MS = 30_000;

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    return buildPageMeta({
        title: "Trophies",
        description: "Achievements you can earn across the community.",
        url: "/trophies",
        type: "website",
    });
}

interface TrophyRow {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    points: number;
    _count: { users: number };
}

async function fetchTrophies(): Promise<TrophyRow[]> {
    try {
        return await cached<TrophyRow[]>(
            TROPHIES_PUBLIC_CACHE_KEY,
            TROPHIES_PUBLIC_TTL_MS,
            () =>
                prisma.trophy.findMany({
                    where: { isActive: true },
                    orderBy: [{ points: "desc" }, { name: "asc" }],
                    include: { _count: { select: { users: true } } },
                }),
        );
    } catch {
        return [];
    }
}

async function fetchEarnedIds(userId: string | undefined): Promise<Set<string>> {
    if (!userId) return new Set();
    try {
        const rows = await prisma.userTrophy.findMany({
            where: { userId },
            select: { trophyId: true },
        });
        return new Set(rows.map((r) => r.trophyId));
    } catch {
        return new Set();
    }
}

export default async function PublicTrophiesPage() {
    const [trophies, session, t] = await Promise.all([fetchTrophies(), auth(), getTranslations("profile")]);
    const earnedIds = await fetchEarnedIds(session?.user?.id);

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-5xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Award className="w-7 h-7 text-amber-500" />
                        {t("trophiesPageTitle")}
                    </h1>
                    <p className="text-muted-foreground">
                        {t("trophiesPageDesc")}
                    </p>
                </div>

                {trophies.length === 0 ? (
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
                                    className={`relative rounded-lg border p-4 transition-colors ${
                                        earned ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
                                    }`}
                                >
                                    {earned && (
                                        <span
                                            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-green-500/15 text-green-600 text-xs px-2 py-0.5"
                                            title="You have earned this trophy"
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
                                            <h3 className="font-semibold truncate">{tr.name}</h3>
                                            {tr.description && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {tr.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                                    {tr.points} pts
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

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
