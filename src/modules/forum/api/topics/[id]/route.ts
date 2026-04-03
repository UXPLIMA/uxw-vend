import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { forumPostSchema } from "@/core/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/forum/topics/[id] - Get topic with posts
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const topic = await prisma.forumTopic.findFirst({
        where: { OR: [{ id }, { slug: id }] },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
            category: { select: { id: true, name: true, slug: true, color: true } },
            posts: {
                orderBy: { createdAt: "asc" },
                include: {
                    author: { select: { id: true, username: true, avatar: true } },
                    _count: { select: { likes: true } },
                },
            },
            _count: { select: { likes: true } },
        },
    });

    if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // Increment view count
    await prisma.forumTopic.update({
        where: { id: topic.id },
        data: { views: { increment: 1 } },
    });

    return NextResponse.json({ topic });
}

// POST /api/v1/forum/topics/[id] - Reply to topic
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = forumPostSchema.safeParse({ ...body, topicId: id });

    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const topic = await prisma.forumTopic.findUnique({ where: { id } });
    if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    if (topic.isLocked) {
        return NextResponse.json({ error: "This topic is locked" }, { status: 403 });
    }

    const post = await prisma.forumPost.create({
        data: {
            content: validation.data.content,
            topicId: id,
            authorId: session.user.id,
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
        },
    });

    return NextResponse.json({ post }, { status: 201 });
}

// PATCH /api/v1/forum/topics/[id] - Update topic (admin: pin/lock)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const topic = await prisma.forumTopic.findUnique({ where: { id } });
    if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // Only author can edit content, admin can pin/lock
    const adminCheck = await isAdmin(session.user.id);
    const isAuthor = topic.authorId === session.user.id;

    if (!isAuthor && !adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (isAuthor && body.title) data.title = body.title;
    if (isAuthor && body.content) data.content = body.content;
    if (adminCheck && body.isPinned !== undefined) data.isPinned = body.isPinned;
    if (adminCheck && body.isLocked !== undefined) data.isLocked = body.isLocked;

    const updated = await prisma.forumTopic.update({
        where: { id },
        data,
    });

    return NextResponse.json({ topic: updated });
}

// DELETE /api/v1/forum/topics/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const topic = await prisma.forumTopic.findUnique({ where: { id } });
    if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (topic.authorId !== session.user.id && !adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.forumTopic.delete({ where: { id } });

    return NextResponse.json({ message: "Topic deleted" });
}
