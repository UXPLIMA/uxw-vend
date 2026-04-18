import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ username: string }> };

// GET /api/v1/players/[username] - Public player profile
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { username } = await params;

    const user = await prisma.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" } },
        select: {
            id: true,
            username: true,
            avatar: true,
            createdAt: true,
            role: { select: { name: true, displayName: true, color: true } },
            _count: {
                select: {
                    orders: true,
                    topics: true,
                    posts: true,
                    comments: true,
                    suggestions: true,
                },
            },
        },
    });

    if (!user) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    // Recent forum activity
    const recentTopics = await prisma.forumTopic.findMany({
        where: { authorId: user.id },
        select: { id: true, title: true, slug: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
    });

    // Linked accounts (public info only)
    const linkedAccounts = await prisma.linkedAccount.findMany({
        where: { userId: user.id },
        select: { provider: true, username: true },
    });

    return NextResponse.json({
        player: {
            ...user,
            recentTopics,
            linkedAccounts,
        },
    });
}
