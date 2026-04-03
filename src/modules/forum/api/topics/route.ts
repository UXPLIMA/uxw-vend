import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { forumTopicSchema } from "@/core/lib/validations";
import { generateSlug } from "@/core/lib/utils";
import { notifyForumTopicCreated } from "@/core/lib/discord";

// GET /api/v1/forum/topics
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const categoryId = searchParams.get("category");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (search) where.title = { contains: search, mode: "insensitive" };

    const [topics, total] = await Promise.all([
        prisma.forumTopic.findMany({
            where,
            include: {
                author: { select: { id: true, username: true, avatar: true } },
                category: { select: { id: true, name: true, slug: true, color: true } },
                _count: { select: { posts: true, likes: true } },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        }),
        prisma.forumTopic.count({ where }),
    ]);

    return NextResponse.json({
        topics,
        total,
        pages: Math.ceil(total / limit),
        page,
    });
}

// POST /api/v1/forum/topics
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = forumTopicSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }

    const { title, content, categoryId } = validation.data;
    let slug = generateSlug(title);

    // Deduplicate slug
    const existingSlug = await prisma.forumTopic.findUnique({ where: { slug } });
    if (existingSlug) {
        slug = `${slug}-${Date.now().toString(36)}`;
    }

    const topic = await prisma.forumTopic.create({
        data: {
            title,
            slug,
            content,
            categoryId,
            authorId: session.user.id,
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
            category: { select: { id: true, name: true, slug: true } },
        },
    });

    // Discord notification
    notifyForumTopicCreated({
        title: topic.title,
        username: topic.author.username,
        category: topic.category?.name || "General",
    }).catch(console.error);

    return NextResponse.json({ topic }, { status: 201 });
}
