import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Award } from "lucide-react";
import { prisma } from "@/core/lib/db";
import { Link } from "@/core/lib/i18n/navigation";
import { getTranslations } from "next-intl/server";

/**
 * Top trophies widget — 3 rarest trophies (fewest holders).
 */
export default async function TopTrophiesWidget() {
    const t = await getTranslations("admin");
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
                    {t("widget_rarestTrophies")}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {trophies.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">{t("widget_noTrophies")}</p>
                ) : (
                    <ul className="space-y-1.5">
                        {trophies.map((tr) => (
                            <li key={tr.id} className="text-xs flex items-center justify-between">
                                <span className="truncate">{tr.name}</span>
                                <span className="text-muted-foreground whitespace-nowrap">{tr._count.users} {tr._count.users === 1 ? t("widget_holder") : t("widget_holders")}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <Link href="/admin/trophies" className="text-xs text-primary hover:underline mt-2 inline-block">
                    {t("widget_manage")} →
                </Link>
            </CardContent>
        </Card>
    );
}
