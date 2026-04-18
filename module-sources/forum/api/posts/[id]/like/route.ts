import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/forum/posts/[id]/like - Toggle like
export async function POST(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Race-safe toggle: delete-first then fallback to create. The
    // @@unique([postId, userId]) constraint prevents duplicate creates
    // under concurrent requests; the delete-by-compound-key is idempotent.
    const userId = session.user.id;
    let liked: boolean;
    const deleted = await prisma.forumPostLike.deleteMany({
        where: { postId: id, userId },
    });
    if (deleted.count > 0) {
        liked = false;
    } else {
        try {
            await prisma.forumPostLike.create({ data: { postId: id, userId } });
            liked = true;
        } catch (err) {
            // P2002: another concurrent request beat us to the create —
            // state is consistent (one like row exists), report current state.
            const code = (err as { code?: string }).code;
            if (code === "P2002") {
                liked = true;
            } else {
                throw err;
            }
        }
    }

    const count = await prisma.forumPostLike.count({ where: { postId: id } });
    return NextResponse.json({ liked, count });
}
