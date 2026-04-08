import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
import { prisma } from "@/core/lib/db";
import { ActivityFeedList, type ActivityItem } from "@/core/components/activity/ActivityFeedList";

/**
 * Core homepage section: recent public activity feed.
 *
 * A theme or page layout can import and render this server component to
 * surface the latest cross-module activity. It reads directly from the
 * database (no API round trip) and renders up to `limit` public items.
 */
export async function ActivityFeedSection({ limit = 10 }: { limit?: number } = {}) {
    let items: ActivityItem[] = [];
    try {
        const rows = await prisma.activityFeedItem.findMany({
            where: { isPublic: true },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                actor: { select: { id: true, username: true, avatar: true } },
            },
        });
        items = rows.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            body: r.body,
            href: r.href,
            icon: r.icon,
            isPublic: r.isPublic,
            createdAt: r.createdAt.toISOString(),
            actor: r.actor,
        }));
    } catch {
        items = [];
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recent Activity
                </h2>
                <Link href="/activity" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                </Link>
            </div>
            <ActivityFeedList items={items} />
        </section>
    );
}

export default ActivityFeedSection;
