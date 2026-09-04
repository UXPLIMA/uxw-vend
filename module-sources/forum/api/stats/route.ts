import { NextRequest, NextResponse } from "next/server";
import { dailySeries, dayLabels, isAdmin, prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

/**
 * The dashboard and analytics screens are the only callers, and both are
 * behind the admin panel. Without this the endpoint answered anyone: an
 * anonymous request read the numbers straight out of the database.
 */
async function requireAdmin(): Promise<NextResponse | null> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return null;
}

export async function GET(request: NextRequest) {
    const denied = await requireAdmin();
    if (denied) return denied;

    const period = Math.min(
        365,
        Math.max(1, parseInt(request.nextUrl.searchParams.get("period") || "30", 10) || 30),
    );

    const topics = await prisma.forumTopic.count();
    const recentTopics = await prisma.forumTopic.findMany({
        take: 5, orderBy: { createdAt: "desc" },
        include: { author: { select: { username: true } }, category: { select: { name: true } } },
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    startDate.setHours(0, 0, 0, 0);

    // Grouped by the database. This used to read every row in the window and
    // bucket it here, so the work grew with the site's history to produce one
    // number per day.
    const series = await dailySeries({ table: "ForumTopic", since: startDate });

    const labels = dayLabels(startDate, period);
    const byDay: Record<string, number> = Object.fromEntries(labels.map((k) => [k, 0]));
    for (const row of series) {
        if (row.day in byDay) byDay[row.day] = row.count;
    }

    return NextResponse.json({
        stats: { topics },
        charts: [
            {
                id: "forum-topics",
                label: "Topics per day",
                labelKey: "analytics_forumTopicsPerDay",
                labels,
                data: labels.map((k) => byDay[k]),
                color: "#f59e0b",
            },
        ],
        sections: [{
            id: "recent-topics",
            title: "Latest Forum Topics",
            titleKey: "dashboard_latestForumTopics",
            viewAllHref: "/admin/forum/topics",
            items: recentTopics.map(t => ({
                id: t.id,
                primary: t.title,
                secondary: (t.author?.username ?? "Deleted user") + " · " + t.category.name,
            }))
        }]
    });
}
