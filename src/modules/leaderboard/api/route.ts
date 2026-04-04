import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

// GET /api/v1/leaderboard?type=buyers|voters|forum
export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get("type") || "buyers";
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

    switch (type) {
        case "buyers": {
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

            const leaderboard = orders.map((o) => {
                const user = users.find((u) => u.id === o.userId);
                return {
                    username: user?.username || "Unknown",
                    avatar: user?.avatar,
                    value: Number(o._sum.total || 0),
                    count: o._count,
                };
            });

            return NextResponse.json({ type: "buyers", leaderboard });
        }

        case "voters": {
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

            const leaderboard = votes.map((v) => {
                const user = users.find((u) => u.id === v.userId);
                return {
                    username: user?.username || "Unknown",
                    avatar: user?.avatar,
                    value: v._count,
                };
            });

            return NextResponse.json({ type: "voters", leaderboard });
        }

        case "forum": {
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

            const leaderboard = posts.map((p) => {
                const user = users.find((u) => u.id === p.authorId);
                return {
                    username: user?.username || "Unknown",
                    avatar: user?.avatar,
                    value: p._count,
                };
            });

            return NextResponse.json({ type: "forum", leaderboard });
        }

        default:
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
}
