import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

export async function GET(request: NextRequest) {
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

    const created = await prisma.forumTopic.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
    });

    const labels: string[] = [];
    const byDay: Record<string, number> = {};
    for (let i = 0; i <= period; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        labels.push(key);
        byDay[key] = 0;
    }
    for (const row of created) {
        const key = row.createdAt.toISOString().split("T")[0];
        if (key in byDay) byDay[key] += 1;
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
