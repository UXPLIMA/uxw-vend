import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { getClientIP, rateLimitForRoleAsync } from "@/core/lib/rate-limit";
import { auth } from "@/core/lib/auth";

/**
 * GET /api/v1/activity-feed
 * Public — returns recent isPublic feed items.
 * Query: ?limit=20&before=<iso-date>&userId=<id>&scope=mine
 *
 * When `scope=mine` is set AND the caller is authenticated, the response
 * includes the caller's private (isPublic=false) items as well, filtered
 * to actorId === session.user.id.
 *
 * Rate limited to 60 requests per minute by client IP.
 */
export async function GET(request: NextRequest) {
    const ip = getClientIP(request.headers);
    const allowed = await rateLimitForRoleAsync(
        `activity-feed:${ip}`,
        { maxRequests: 60, windowMs: 60_000 },
        null,
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 50);
    const before = searchParams.get("before");
    const userId = searchParams.get("userId");
    const scope = searchParams.get("scope");

    const where: {
        isPublic?: boolean;
        createdAt?: { lt: Date };
        actorId?: string;
    } = {};

    if (scope === "mine") {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Return both public and private items for the current user
        where.actorId = session.user.id;
    } else {
        where.isPublic = true;
        if (userId) where.actorId = userId;
    }

    if (before) {
        const d = new Date(before);
        if (!Number.isNaN(d.getTime())) where.createdAt = { lt: d };
    }

    const items = await prisma.activityFeedItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            actor: { select: { id: true, username: true, avatar: true } },
        },
    });

    const nextCursor = items.length === limit ? items[items.length - 1].createdAt.toISOString() : null;

    return NextResponse.json({ items, nextCursor });
}
