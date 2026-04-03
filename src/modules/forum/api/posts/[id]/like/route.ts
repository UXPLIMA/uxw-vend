import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/forum/posts/[id]/like - Toggle like
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const existingLike = await prisma.forumPostLike.findUnique({
        where: {
            postId_userId: {
                postId: id,
                userId: session.user.id,
            },
        },
    });

    if (existingLike) {
        await prisma.forumPostLike.delete({ where: { id: existingLike.id } });
        const count = await prisma.forumPostLike.count({ where: { postId: id } });
        return NextResponse.json({ liked: false, count });
    } else {
        await prisma.forumPostLike.create({
            data: { postId: id, userId: session.user.id },
        });
        const count = await prisma.forumPostLike.count({ where: { postId: id } });
        return NextResponse.json({ liked: true, count });
    }
}
