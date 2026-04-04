import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

// GET /api/v1/suggestions - Public list
export async function GET(request: NextRequest) {
    const status = request.nextUrl.searchParams.get("status");
    const sort = request.nextUrl.searchParams.get("sort") || "newest";
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

    const where = status ? { status } : {};
    const orderBy = sort === "popular"
        ? { upvotes: "desc" as const }
        : { createdAt: "desc" as const };

    const [suggestions, total] = await Promise.all([
        prisma.suggestion.findMany({
            where,
            include: {
                author: { select: { id: true, username: true, avatar: true } },
                _count: { select: { votes: true } },
            },
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.suggestion.count({ where }),
    ]);

    return NextResponse.json({ suggestions, total, pages: Math.ceil(total / limit) });
}

// POST /api/v1/suggestions - Create suggestion
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, content } = await request.json();
    if (!title || !content) return NextResponse.json({ error: "Title and content required" }, { status: 400 });

    const suggestion = await prisma.suggestion.create({
        data: {
            title,
            content,
            authorId: session.user.id,
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
        },
    });

    return NextResponse.json({ suggestion }, { status: 201 });
}
