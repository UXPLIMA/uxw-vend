import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma } from "@/core/sdk/server";
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
