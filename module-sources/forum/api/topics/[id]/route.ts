import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { forumPostSchema } from "../../../lib/validations";
import { rateLimitForRole } from "@/core/lib/rate-limit";
import { sanitizeHtml } from "@/core/lib/sanitize";

type ModerationSettingValue = {
    blog_comments?: "auto" | "manual";
    forum_topics?: "auto" | "manual";
    forum_posts?: "auto" | "manual";
    suggestions?: "auto" | "manual";
};

async function getModerationMode(field: keyof ModerationSettingValue): Promise<"auto" | "manual"> {
    const setting = await prisma.setting.findUnique({ where: { key: "moderation" } });
    const value = (setting?.value ?? {}) as ModerationSettingValue;
    return value[field] === "manual" ? "manual" : "auto";
}

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/forum/topics/[id] - Get topic with posts
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const sessionGet = await auth();
    const adminCheckGet = sessionGet?.user?.id ? await isAdmin(sessionGet.user.id) : false;

    const topic = await prisma.forumTopic.findFirst({
        where: { OR: [{ id }, { slug: id }, ...(isNaN(Number(id)) ? [] : [{ number: Number(id) }])] },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
            category: { select: { id: true, name: true, slug: true, color: true } },
            posts: {
                where: adminCheckGet ? undefined : { moderationState: "APPROVED" },
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

    // Non-admins cannot see pending/rejected topics
    if (!adminCheckGet && topic.moderationState !== "APPROVED") {
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

    const rl = await rateLimitForRole(
        `forum-reply:${session.user.id}`,
        { maxRequests: 20, windowMs: 3_600_000 },
        session.user.role
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

    const mode = await getModerationMode("forum_posts");
    const moderationState = mode === "manual" ? "PENDING" : "APPROVED";

    const post = await prisma.forumPost.create({
        data: {
            content: sanitizeHtml(validation.data.content),
            topicId: id,
            authorId: session.user.id,
            moderationState,
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
        },
    });

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("forum.post.created", post);

    // Public activity feed entry
    await prisma.activityFeedItem.create({
        data: {
            type: "forum.post.created",
            actorId: session.user.id,
            title: `Replied to: ${topic.title}`,
            href: `/forum/topic/${topic.slug || topic.id}`,
            icon: "MessageCircle",
            isPublic: true,
        },
    }).catch(() => {});

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
    if (isAuthor && body.content) data.content = sanitizeHtml(body.content);
    if (adminCheck && body.isPinned !== undefined) data.isPinned = body.isPinned;
    if (adminCheck && body.isLocked !== undefined) data.isLocked = body.isLocked;

    // Only snapshot on content-meaningful edits (title / content), not pin/lock toggles
    if (data.title !== undefined || data.content !== undefined) {
        const { recordRevision } = await import("@/core/lib/revisions");
        await recordRevision("forum.topic", id, topic, "update", session.user.id);
    }

    const updated = await prisma.forumTopic.update({
        where: { id },
        data,
    });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("forum.topic.updated", updated);

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

    // Snapshot the deleted topic for potential restore
    const { recordRevision } = await import("@/core/lib/revisions");
    await recordRevision("forum.topic", id, topic, "delete", session.user.id);

    await prisma.forumTopic.delete({ where: { id } });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("forum.topic.deleted", topic);

    return NextResponse.json({ message: "Topic deleted" });
}
