import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { blogArticleSchema } from "../../lib/validations";
import { generateSlug } from "@/core/lib/utils";
import { sanitizeHtml } from "@/core/lib/sanitize";

// GET /api/v1/blog/articles - List all articles (public)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10") || 10));
    const status = searchParams.get("status") || "PUBLISHED";
    const categoryId = searchParams.get("categoryId");

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Non-admin users can only see published articles
    const session = await auth();
    const adminCheck = session?.user?.id ? await isAdmin(session.user.id) : false;

    if (!adminCheck) {
        where.status = "PUBLISHED";
        where.publishedAt = { lte: new Date() };
        where.OR = [{ publishAt: null }, { publishAt: { lte: new Date() } }];
    } else if (status && status !== "ALL") {
        where.status = status;
    }

    if (categoryId) {
        where.categoryId = categoryId;
    }

    const [articles, total] = await Promise.all([
        prisma.blogArticle.findMany({
            where,
            skip,
            take: limit,
            orderBy: { publishedAt: "desc" },
            include: {
                author: { select: { id: true, username: true, avatar: true } },
                category: { select: { id: true, name: true, slug: true } },
                tags: { select: { id: true, name: true, slug: true } },
            },
        }),
        prisma.blogArticle.count({ where }),
    ]);

    return NextResponse.json({
        articles,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}

// POST /api/v1/blog/articles - Create new article (admin only)
export async function POST(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = blogArticleSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { title, excerpt, content, coverImage, status, publishedAt, publishAt, categoryId, tags } = validation.data;

    // If publishAt is in the future, force SCHEDULED status
    const publishAtDate = publishAt ? new Date(publishAt) : null;
    const scheduleInFuture = publishAtDate !== null && publishAtDate.getTime() > Date.now();
    const effectiveStatus = scheduleInFuture ? "SCHEDULED" : (status || "DRAFT");

    // Generate slug from title
    const slug = body.slug || generateSlug(title);

    // Check if slug already exists
    const existingArticle = await prisma.blogArticle.findUnique({ where: { slug } });
    if (existingArticle) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }

    // Connect or create tags
    const tagConnections = tags?.length
        ? {
            connectOrCreate: tags.map((tagName: string) => ({
                where: { slug: generateSlug(tagName) },
                create: { name: tagName, slug: generateSlug(tagName) },
            })),
        }
        : undefined;

    const article = await prisma.blogArticle.create({
        data: {
            title,
            slug,
            excerpt,
            content: sanitizeHtml(content),
            coverImage,
            status: effectiveStatus,
            publishedAt: publishedAt ? new Date(publishedAt) : null,
            publishAt: publishAtDate,
            authorId: session.user.id,
            categoryId,
            tags: tagConnections,
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
            category: true,
            tags: true,
        },
    });

    // Fire hook for cross-module reactions (discord webhook, notifications, etc.)
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("blog.article.created", article);

    return NextResponse.json(article, { status: 201 });
}
