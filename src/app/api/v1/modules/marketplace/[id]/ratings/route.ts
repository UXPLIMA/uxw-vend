import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

// GET /api/v1/modules/marketplace/[id]/ratings
// Returns every rating/review left on the given module with the author's
// username. Admin-only (marketplace management surface).
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: moduleId } = await params;
    if (!/^[a-z0-9-]+$/.test(moduleId)) {
        return NextResponse.json({ error: "Invalid module id" }, { status: 400 });
    }

    const rows = await prisma.moduleRating.findMany({
        where: { moduleId },
        orderBy: { updatedAt: "desc" },
        take: 200,
    });

    // Fetch usernames in a single query to avoid N+1.
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = userIds.length
        ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, username: true, avatar: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const agg = await prisma.moduleRating.aggregate({
        where: { moduleId },
        _avg: { rating: true },
        _count: { _all: true },
    });

    return NextResponse.json({
        ratings: rows.map((r) => {
            const u = userMap.get(r.userId);
            return {
                id: r.id,
                rating: r.rating,
                review: r.review,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                user: u ? { id: u.id, username: u.username, avatar: u.avatar } : null,
            };
        }),
        aggregate: {
            average:
                agg._avg.rating !== null
                    ? Math.round(Number(agg._avg.rating) * 10) / 10
                    : null,
            count: agg._count._all,
        },
    });
}
