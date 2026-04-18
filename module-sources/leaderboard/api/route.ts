import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { cached } from "@/core/lib/cache";

interface LeaderboardEntry {
    username: string;
    avatar: string | null;
    value: number;
    count?: number;
}

const LEADERBOARD_TTL_MS = 5 * 60_000; // 5 minutes

async function buildBuyers(limit: number): Promise<LeaderboardEntry[]> {
    const orders = await prisma.order.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED" },
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: "desc" } },
        take: limit,
    });

    const userIds = orders.map((o) => o.userId);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, avatar: true },
    });
    // O(1) lookup Map instead of .find() per row (was O(n²)).
    const userById = new Map(users.map((u) => [u.id, u]));

    return orders.map((o) => {
        const user = userById.get(o.userId);
        return {
            username: user?.username || "Unknown",
            avatar: user?.avatar ?? null,
            value: Number(o._sum.total || 0),
            count: o._count,
        };
    });
}

async function buildVoters(limit: number): Promise<LeaderboardEntry[]> {
    const votes = await prisma.voteLog.groupBy({
        by: ["userId"],
        _count: true,
        orderBy: { _count: { userId: "desc" } },
        take: limit,
    });

    const userIds = votes.map((v) => v.userId);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, avatar: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return votes.map((v) => {
        const user = userById.get(v.userId);
        return {
            username: user?.username || "Unknown",
            avatar: user?.avatar ?? null,
            value: v._count,
        };
    });
}

async function buildForum(limit: number): Promise<LeaderboardEntry[]> {
    const posts = await prisma.forumPost.groupBy({
        by: ["authorId"],
        _count: true,
        orderBy: { _count: { authorId: "desc" } },
        take: limit,
    });

    const userIds = posts.map((p) => p.authorId);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, avatar: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return posts.map((p) => {
        const user = userById.get(p.authorId);
        return {
            username: user?.username || "Unknown",
            avatar: user?.avatar ?? null,
            value: p._count,
        };
    });
}

// GET /api/v1/leaderboard?type=buyers|voters|forum
export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get("type") || "buyers";
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "10") || 20));

    const cacheKey = `leaderboard:${type}:${limit}`;

    switch (type) {
        case "buyers": {
            const leaderboard = await cached<LeaderboardEntry[]>(
                cacheKey,
                LEADERBOARD_TTL_MS,
                () => buildBuyers(limit),
            );
            return NextResponse.json({ type: "buyers", leaderboard });
        }

        case "voters": {
            const leaderboard = await cached<LeaderboardEntry[]>(
                cacheKey,
                LEADERBOARD_TTL_MS,
                () => buildVoters(limit),
            );
            return NextResponse.json({ type: "voters", leaderboard });
        }

        case "forum": {
            const leaderboard = await cached<LeaderboardEntry[]>(
                cacheKey,
                LEADERBOARD_TTL_MS,
                () => buildForum(limit),
            );
            return NextResponse.json({ type: "forum", leaderboard });
        }

        default:
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
}
