import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// DELETE /api/v1/blog/comments/[id] - Delete a comment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const comment = await prisma.blogComment.findUnique({
        where: { id },
    });

    if (!comment) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check if user is the author or an admin
    const adminCheck = await isAdmin(session.user.id);
    if (comment.authorId !== session.user.id && !adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.blogComment.delete({ where: { id } });

    return NextResponse.json({ message: "Comment deleted successfully" });
}

// PATCH /api/v1/blog/comments/[id] - Update comment (admin: approve/reject)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const comment = await prisma.blogComment.findUnique({
        where: { id },
    });

    if (!comment) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const body = await request.json();
    const { isApproved } = body;

    const updatedComment = await prisma.blogComment.update({
        where: { id },
        data: { isApproved },
        include: {
            author: {
                select: { id: true, username: true, avatar: true },
            },
        },
    });

    return NextResponse.json(updatedComment);
}
