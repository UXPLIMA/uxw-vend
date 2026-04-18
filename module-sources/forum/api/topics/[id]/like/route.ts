import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/forum/topics/[id]/like - Toggle like
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const topic = await prisma.forumTopic.findUnique({ where: { id } });
    if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const existingLike = await prisma.forumTopicLike.findUnique({
        where: {
            topicId_userId: {
                topicId: id,
                userId: session.user.id,
            },
        },
    });

    if (existingLike) {
        // Unlike
        await prisma.forumTopicLike.delete({ where: { id: existingLike.id } });
        const count = await prisma.forumTopicLike.count({ where: { topicId: id } });
        return NextResponse.json({ liked: false, count });
    } else {
        // Like
        await prisma.forumTopicLike.create({
            data: {
                topicId: id,
                userId: session.user.id,
            },
        });
        const count = await prisma.forumTopicLike.count({ where: { topicId: id } });
        return NextResponse.json({ liked: true, count });
    }
}

// GET /api/v1/forum/topics/[id]/like - Check if user liked
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    const { id } = await params;

    const count = await prisma.forumTopicLike.count({ where: { topicId: id } });

    if (!session?.user?.id) {
        return NextResponse.json({ liked: false, count });
    }

    const existingLike = await prisma.forumTopicLike.findUnique({
        where: {
            topicId_userId: {
                topicId: id,
                userId: session.user.id,
            },
        },
    });

    return NextResponse.json({ liked: !!existingLike, count });
}
