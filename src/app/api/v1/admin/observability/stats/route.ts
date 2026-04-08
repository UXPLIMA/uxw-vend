import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

/**
 * GET /api/v1/admin/observability/stats
 *
 * Aggregate platform metrics for the observability dashboard:
 *   - activity feed item counts (24h, 7d)
 *   - total user count
 *   - count of currently enabled modules
 *   - total revisions recorded
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [activity24h, activity7d, users, enabledModules, revisions] = await Promise.all([
        prisma.activityFeedItem.count({ where: { createdAt: { gte: dayAgo } } }),
        prisma.activityFeedItem.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.user.count(),
        prisma.moduleConfig.count({ where: { enabled: true } }),
        prisma.revision.count(),
    ]);

    return NextResponse.json({
        data: {
            activityFeed: { last24h: activity24h, last7d: activity7d },
            users,
            enabledModules,
            revisions,
        },
    });
}
