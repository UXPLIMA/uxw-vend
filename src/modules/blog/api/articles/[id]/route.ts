import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { blogArticleSchema } from "@/core/lib/validations";
import { generateSlug } from "@/core/lib/utils";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/v1/blog/articles/[id] - Get single article
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const article = await prisma.blogArticle.findFirst({
        where: {
            OR: [{ id }, { slug: id }, ...(isNaN(Number(id)) ? [] : [{ number: Number(id) }])],
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
            category: { select: { id: true, name: true, slug: true } },
            tags: { select: { id: true, name: true, slug: true } },
            comments: {
                where: { isApproved: true },
                orderBy: { createdAt: "desc" },
                include: {
                    author: { select: { id: true, username: true, avatar: true } },
                },
            },
        },
    });

    if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(article);
}

// PATCH /api/v1/blog/articles/[id] - Update article (admin only)
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

    const article = await prisma.blogArticle.findUnique({ where: { id } });
    if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = blogArticleSchema.partial().safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { title, excerpt, content, coverImage, status, publishedAt, categoryId, tags } = validation.data;

    // Generate new slug if title changed
    let slug = article.slug;
    if (title && title !== article.title) {
        slug = body.slug || generateSlug(title);
        const existingSlug = await prisma.blogArticle.findFirst({
            where: { slug, id: { not: id } },
        });
        if (existingSlug) {
            return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
        }
    }

    // Handle tags update
    let tagUpdate = {};
    if (tags !== undefined) {
        tagUpdate = {
            tags: {
                set: [],
                connectOrCreate: tags.map((tagName: string) => ({
                    where: { slug: generateSlug(tagName) },
                    create: { name: tagName, slug: generateSlug(tagName) },
                })),
            },
        };
    }

    const updatedArticle = await prisma.blogArticle.update({
        where: { id },
        data: {
            title,
            slug,
            excerpt,
            content,
            coverImage,
            status,
            publishedAt: publishedAt ? new Date(publishedAt) : undefined,
            categoryId,
            ...tagUpdate,
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
            category: true,
            tags: true,
        },
    });

    return NextResponse.json(updatedArticle);
}

// DELETE /api/v1/blog/articles/[id] - Delete article (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const article = await prisma.blogArticle.findUnique({ where: { id } });
    if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    await prisma.blogArticle.delete({ where: { id } });

    return NextResponse.json({ message: "Article deleted successfully" });
}
