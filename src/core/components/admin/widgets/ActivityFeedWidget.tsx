import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Activity } from "lucide-react";
import { prisma } from "@/core/lib/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Activity feed widget — 5 most recent public feed items.
 */
export default async function ActivityFeedWidget() {
    const t = await getTranslations("admin");
    let items: Array<{ id: string; title: string; createdAt: Date; actor: { username: string } | null }> = [];
    try {
        items = await prisma.activityFeedItem.findMany({
            where: { isPublic: true },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { actor: { select: { username: true } } },
        });
    } catch { /* degrade */ }

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    {t("widget_recentActivity")}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">{t("widget_noActivity")}</p>
                ) : (
                    <ul className="space-y-1.5">
                        {items.map((item) => (
                            <li key={item.id} className="text-xs flex items-center justify-between gap-2">
                                <span className="truncate">
                                    {item.actor?.username && <span className="font-medium">{item.actor.username}</span>}
                                    {item.actor?.username && " "}
                                    {item.title}
                                </span>
                                <span className="text-muted-foreground whitespace-nowrap">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <Link href="/activity" className="text-xs text-primary hover:underline mt-2 inline-block">
                    {t("widget_viewAll")} →
                </Link>
            </CardContent>
        </Card>
    );
}
