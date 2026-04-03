import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { blogArticleSchema } from "@/core/lib/validations";
import { generateSlug } from "@/core/lib/utils";

// GET /api/v1/blog/articles - List all articles (public)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
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

    const { title, excerpt, content, coverImage, status, publishedAt, categoryId, tags } = validation.data;

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
            content,
            coverImage,
            status: status || "DRAFT",
            publishedAt: publishedAt ? new Date(publishedAt) : null,
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

    return NextResponse.json(article, { status: 201 });
}
