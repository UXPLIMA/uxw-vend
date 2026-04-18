import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { forumTopicSchema } from "../../lib/validations";
import { generateSlug } from "@/core/lib/utils";
import { sendDiscordWebhook } from "@/core/lib/discord";
import { rateLimitForRole } from "@/core/lib/rate-limit";
import { sanitizeHtml } from "@/core/lib/sanitize";

type ModerationSettingValue = {
    blog_comments?: "auto" | "manual";
    forum_topics?: "auto" | "manual";
    forum_posts?: "auto" | "manual";
    suggestions?: "auto" | "manual";
};

async function getModerationMode(field: keyof ModerationSettingValue): Promise<"auto" | "manual"> {
    const setting = await prisma.setting.findUnique({ where: { key: "moderation" } });
    const value = (setting?.value ?? {}) as ModerationSettingValue;
    return value[field] === "manual" ? "manual" : "auto";
}

// GET /api/v1/forum/topics
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const categoryId = searchParams.get("category");
    const search = searchParams.get("search") || "";

    const session = await auth();
    const adminCheck = session?.user?.id ? await isAdmin(session.user.id) : false;

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (search) where.title = { contains: search, mode: "insensitive" };
    if (!adminCheck) where.moderationState = "APPROVED";

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

    const rl = await rateLimitForRole(
        `forum-topic:${session.user.id}`,
        { maxRequests: 5, windowMs: 3_600_000 },
        session.user.role
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const validation = forumTopicSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { title, content, categoryId } = validation.data;
    let slug = generateSlug(title);

    // Deduplicate slug
    const existingSlug = await prisma.forumTopic.findUnique({ where: { slug } });
    if (existingSlug) {
        slug = `${slug}-${Date.now().toString(36)}`;
    }

    const mode = await getModerationMode("forum_topics");
    const moderationState = mode === "manual" ? "PENDING" : "APPROVED";

    const topic = await prisma.forumTopic.create({
        data: {
            title,
            slug,
            content: sanitizeHtml(content),
            categoryId,
            authorId: session.user.id,
            moderationState,
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
            category: { select: { id: true, name: true, slug: true } },
        },
    });

    // Discord notification
    sendDiscordWebhook("forum_topic_created", {
        embeds: [{
            title: "New Forum Topic",
            color: 0x6366f1,
            fields: [
                { name: "Title", value: topic.title, inline: true },
                { name: "Author", value: topic.author.username, inline: true },
                { name: "Category", value: topic.category?.name || "General", inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    }).catch(console.error);

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("forum.topic.created", topic);

    // Public activity feed entry
    await prisma.activityFeedItem.create({
        data: {
            type: "forum.topic.created",
            actorId: session.user.id,
            title: `New topic: ${topic.title}`,
            href: `/forum/topic/${topic.slug || topic.id}`,
            icon: "MessageSquare",
            isPublic: true,
        },
    }).catch(() => {});

    return NextResponse.json({ topic }, { status: 201 });
}
