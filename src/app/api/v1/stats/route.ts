import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { cached } from "@/core/lib/cache";
import { dailySeries, dayLabels } from "@/core/lib/daily-series";

// GET /api/v1/stats?period=30d - Core stats (Users only, module stats come from module statsApi)
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const period = request.nextUrl.searchParams.get("period") || "30d";
    const days = Math.min(365, Math.max(1, parseInt(period) || 30));

    const payload = await cached(`stats:core:${days}`, 60_000, async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // Grouped by the database. This used to read every user row created in
        // the window - a year of signups on a busy site - to produce one number
        // per day.
        const series = await dailySeries({ table: "User", since: startDate });

        const labels = dayLabels(startDate, days);
        const usersByDay: Record<string, number> = Object.fromEntries(labels.map((k) => [k, 0]));
        for (const row of series) {
            if (row.day in usersByDay) usersByDay[row.day] = row.count;
        }

        return {
            labels,
            users: labels.map((k) => usersByDay[k]),
            totals: { users: series.reduce((sum, row) => sum + row.count, 0) },
        };
    });

    return NextResponse.json(payload);
}
