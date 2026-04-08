import { Award, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/core/lib/db";

/**
 * TrophyShowcase — server component homepage section.
 *
 * Shows the three rarest (fewest earners) and three most-awarded active
 * trophies side-by-side. Themes can embed this component directly; it
 * is NOT wired into any theme by default so existing themes are not
 * visually altered.
 *
 * Fails silently if the trophy tables are missing or the DB query
 * fails — useful on fresh installs that haven't seeded trophies yet.
 */

interface ShowcaseTrophy {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    points: number;
    _count: { users: number };
}

async function loadShowcase(): Promise<{ rarest: ShowcaseTrophy[]; popular: ShowcaseTrophy[] }> {
    try {
        const all = await prisma.trophy.findMany({
            where: { isActive: true },
            include: { _count: { select: { users: true } } },
        });
        const byPopularity = [...all].sort((a, b) => b._count.users - a._count.users);
        const byRarity = [...all]
            .filter((t) => t._count.users > 0)
            .sort((a, b) => a._count.users - b._count.users);
        return {
            popular: byPopularity.slice(0, 3),
            rarest: byRarity.slice(0, 3),
        };
    } catch {
        return { rarest: [], popular: [] };
    }
}

function TrophyCard({ trophy }: { trophy: ShowcaseTrophy }) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-md border border-border bg-card">
            <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: trophy.color || "#6366f1" }}
            >
                <Award className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{trophy.name}</div>
                {trophy.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{trophy.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-amber-600">{trophy.points} pts</span>
                    <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {trophy._count.users}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default async function TrophyShowcase() {
    const { rarest, popular } = await loadShowcase();
    if (rarest.length === 0 && popular.length === 0) return null;

    return (
        <section className="py-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Trophies
                </h2>
                <Link href="/trophies" className="text-sm text-primary hover:underline">
                    View all
                </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {rarest.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Rarest
                        </h3>
                        <div className="space-y-2">
                            {rarest.map((t) => (
                                <TrophyCard key={t.id} trophy={t} />
                            ))}
                        </div>
                    </div>
                )}
                {popular.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Most awarded
                        </h3>
                        <div className="space-y-2">
                            {popular.map((t) => (
                                <TrophyCard key={t.id} trophy={t} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
