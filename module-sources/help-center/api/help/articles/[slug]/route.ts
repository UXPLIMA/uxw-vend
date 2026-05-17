import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { rateLimitForRole } from "@/core/lib/rate-limit";

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
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
    const rl = await rateLimitForRole(
        `help-feedback:${ip}`,
        { maxRequests: 10, windowMs: 3_600_000 },
        undefined
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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

// PATCH /api/v1/help/articles/[slug] — Update article (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { slug } = await params;
    const existing = await prisma.helpArticle.findUnique({ where: { slug } });
    if (!existing) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title;
    if (typeof body.slug === "string") data.slug = body.slug;
    if (typeof body.content === "string") data.content = body.content;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body.categoryId === "string") data.categoryId = body.categoryId;

    const updated = await prisma.helpArticle.update({ where: { id: existing.id }, data });
    return NextResponse.json({ article: updated });
}

// DELETE /api/v1/help/articles/[slug] — Delete article (admin)
export async function DELETE(_: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { slug } = await params;
    const existing = await prisma.helpArticle.findUnique({ where: { slug } });
    if (!existing) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    await prisma.helpArticle.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
}
