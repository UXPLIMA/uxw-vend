import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Award } from "lucide-react";
import { prisma } from "@/core/lib/db";
import Link from "next/link";

/**
 * Top trophies widget — 3 rarest trophies (fewest holders).
 */
export default async function TopTrophiesWidget() {
    let trophies: Array<{ id: string; name: string; icon: string | null; color: string | null; points: number; _count: { users: number } }> = [];
    try {
        trophies = await prisma.trophy.findMany({
            where: { isActive: true },
            include: { _count: { select: { users: true } } },
            orderBy: [{ users: { _count: "asc" } }, { points: "desc" }],
            take: 3,
        });
    } catch { /* degrade */ }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    Rarest trophies
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {trophies.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No trophies configured.</p>
                ) : (
                    <ul className="space-y-1.5">
                        {trophies.map((t) => (
                            <li key={t.id} className="text-xs flex items-center justify-between">
                                <span className="truncate">{t.name}</span>
                                <span className="text-muted-foreground whitespace-nowrap">{t._count.users} holder{t._count.users === 1 ? "" : "s"}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <Link href="/admin/trophies" className="text-xs text-primary hover:underline mt-2 inline-block">
                    Manage →
                </Link>
            </CardContent>
        </Card>
    );
}
