import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

/**
 * GET /api/v1/activity-feed
 * Public — returns recent isPublic feed items.
 * Query: ?limit=20&before=<iso-date>&userId=<id>
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const before = searchParams.get("before");
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = { isPublic: true };
    if (before) where.createdAt = { lt: new Date(before) };
    if (userId) where.actorId = userId;

    const items = await prisma.activityFeedItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            actor: { select: { id: true, username: true, avatar: true } },
        },
    });

    return NextResponse.json({ items });
}
