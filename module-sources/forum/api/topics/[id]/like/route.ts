import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/forum/topics/[id]/like - Toggle like
export async function POST(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const topic = await prisma.forumTopic.findUnique({ where: { id }, select: { id: true } });
    if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const userId = session.user.id;
    let liked: boolean;
    const deleted = await prisma.forumTopicLike.deleteMany({
        where: { topicId: id, userId },
    });
    if (deleted.count > 0) {
        liked = false;
    } else {
        try {
            await prisma.forumTopicLike.create({ data: { topicId: id, userId } });
            liked = true;
        } catch (err) {
            const code = (err as { code?: string }).code;
            if (code === "P2002") {
                liked = true;
            } else {
                throw err;
            }
        }
    }

    const count = await prisma.forumTopicLike.count({ where: { topicId: id } });
    return NextResponse.json({ liked, count });
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
