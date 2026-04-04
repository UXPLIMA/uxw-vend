import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { blogCommentSchema } from "@/core/lib/validations";

// GET /api/v1/blog/comments?articleId=xxx - List comments for an article
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("articleId");

    if (!articleId) {
        return NextResponse.json(
            { error: "Article ID is required" },
            { status: 400 }
        );
    }

    const comments = await prisma.blogComment.findMany({
        where: {
            articleId,
            isApproved: true,
        },
        orderBy: { createdAt: "desc" },
        include: {
            author: {
                select: { id: true, username: true, avatar: true },
            },
        },
    });

    return NextResponse.json(comments);
}

// POST /api/v1/blog/comments - Create a new comment
export async function POST(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = blogCommentSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { content, articleId } = validation.data;

    // Check if article exists
    const article = await prisma.blogArticle.findUnique({
        where: { id: articleId },
    });

    if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Create comment (auto-approve for now, can be changed to manual moderation)
    const comment = await prisma.blogComment.create({
        data: {
            content,
            articleId,
            authorId: session.user.id,
            isApproved: true, // Auto-approve, change to false for moderation
        },
        include: {
            author: {
                select: { id: true, username: true, avatar: true },
            },
        },
    });

    return NextResponse.json(comment, { status: 201 });
}
