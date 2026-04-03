import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

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

    const updated = await prisma.forumPost.update({
        where: { id },
        data: { content: body.content },
        include: { author: { select: { id: true, username: true, avatar: true } } },
    });

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

    await prisma.forumPost.delete({ where: { id } });

    return NextResponse.json({ message: "Post deleted" });
}
