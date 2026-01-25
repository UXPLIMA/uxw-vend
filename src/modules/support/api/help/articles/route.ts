import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { helpArticleSchema } from "@/core/lib/validations";

// GET /api/v1/help/articles - List articles
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = { isActive: true };

    if (categoryId) {
        where.categoryId = categoryId;
    }

    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
        ];
    }

    const articles = await prisma.helpArticle.findMany({
        where,
        take: limit,
        orderBy: { views: "desc" },
        include: {
            category: { select: { id: true, name: true, slug: true } },
        },
    });

    return NextResponse.json(articles);
}

// POST /api/v1/help/articles - Create article (admin)
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
    const validation = helpArticleSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { title, slug, content, categoryId } = validation.data;
    const articleSlug = slug || title.toLowerCase().replace(/\s+/g, "-");

    const article = await prisma.helpArticle.create({
        data: {
            title,
            slug: articleSlug,
            content,
            categoryId,
        },
        include: {
            category: { select: { id: true, name: true, slug: true } },
        },
    });

    return NextResponse.json(article, { status: 201 });
}
