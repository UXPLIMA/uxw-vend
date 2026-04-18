import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

export async function GET(request: NextRequest) {
    const period = Math.min(
        365,
        Math.max(1, parseInt(request.nextUrl.searchParams.get("period") || "30", 10) || 30),
    );

    const articles = await prisma.blogArticle.count();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    startDate.setHours(0, 0, 0, 0);

    const created = await prisma.blogArticle.findMany({
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
        stats: { articles },
        charts: [
            {
                id: "blog-articles",
                label: "Articles per day",
                labelKey: "analytics_blogArticlesPerDay",
                labels,
                data: labels.map((k) => byDay[k]),
                color: "#8b5cf6",
            },
        ],
        sections: [],
    });
}
