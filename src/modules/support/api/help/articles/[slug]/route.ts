import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

interface RouteParams {
    params: Promise<{ slug: string }>;
}

// GET /api/v1/help/articles/[slug] - Get article by slug
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { slug } = await params;

    const article = await prisma.helpArticle.findUnique({
        where: { slug },
        include: {
            category: { select: { id: true, name: true, slug: true } },
        },
    });

    if (!article || !article.isActive) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Increment view count
    await prisma.helpArticle.update({
        where: { id: article.id },
        data: { views: { increment: 1 } },
    });

    return NextResponse.json(article);
}

// POST /api/v1/help/articles/[slug]/feedback - Submit feedback
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { slug } = await params;
    const body = await request.json();
    const { helpful } = body;

    const article = await prisma.helpArticle.findUnique({
        where: { slug },
    });

    if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const updateData = helpful
        ? { helpful: { increment: 1 } }
        : { notHelpful: { increment: 1 } };

    await prisma.helpArticle.update({
        where: { id: article.id },
        data: updateData,
    });

    return NextResponse.json({ success: true });
}
