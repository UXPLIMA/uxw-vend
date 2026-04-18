import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { sanitizeHtml } from "@/core/lib/sanitize";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/forum/posts/[id] - Edit post
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.authorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Snapshot the previous content before edit (subset — posts can be large)
    const { recordRevision } = await import("@/core/lib/revisions");
    await recordRevision(
        "forum.post",
        id,
        { content: post.content, topicId: post.topicId, authorId: post.authorId },
        "update",
        session.user.id
    );

    const updated = await prisma.forumPost.update({
        where: { id },
        data: { content: sanitizeHtml(body.content) },
        include: { author: { select: { id: true, username: true, avatar: true } } },
    });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("forum.post.updated", updated);

    return NextResponse.json({ post: updated });
}

// DELETE /api/v1/forum/posts/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (post.authorId !== session.user.id && !adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Snapshot the deleted post for potential restore (subset — posts can be large)
    const { recordRevision } = await import("@/core/lib/revisions");
    await recordRevision(
        "forum.post",
        id,
        { content: post.content, topicId: post.topicId, authorId: post.authorId, createdAt: post.createdAt },
        "delete",
        session.user.id
    );

    await prisma.forumPost.delete({ where: { id } });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("forum.post.deleted", post);

    return NextResponse.json({ message: "Post deleted" });
}
