import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { rateLimitForRole } from "@/core/lib/rate-limit";
import { sanitizeHtml } from "@/core/lib/sanitize";
import { z } from "zod";

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

// GET /api/v1/suggestions - Public list
export async function GET(request: NextRequest) {
    const session = await auth();
    const status = request.nextUrl.searchParams.get("status");
    const sort = request.nextUrl.searchParams.get("sort") || "newest";
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "20") || 20));

    const isUserAdmin = session?.user?.id ? await isAdmin(session.user.id) : false;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (!isUserAdmin) {
        where.visibility = "public";
        where.moderationState = "APPROVED";
    }
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

    const rl = await rateLimitForRole(
        `suggestion:${session.user.id}`,
        { maxRequests: 5, windowMs: 60_000 },
        session.user.role
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const schema = z.object({
        title: z.string().min(3).max(200),
        content: z.string().min(10).max(5000),
        visibility: z.enum(["public", "private"]).optional().default("public"),
    });
    const validation = schema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });

    const { title, content, visibility } = validation.data;

    const mode = await getModerationMode("suggestions");
    const moderationState = mode === "manual" ? "PENDING" : "APPROVED";

    const suggestion = await prisma.suggestion.create({
        data: {
            title,
            content: sanitizeHtml(content),
            visibility,
            authorId: session.user.id,
            moderationState,
        },
        include: {
            author: { select: { id: true, username: true, avatar: true } },
        },
    });

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("suggestions.suggestion.created", suggestion);

    // Activity feed entry (public only if visibility public)
    await prisma.activityFeedItem.create({
        data: {
            type: "suggestions.suggestion.created",
            actorId: session.user.id,
            title: `Suggested: ${suggestion.title}`,
            href: `/suggestions/${suggestion.id}`,
            icon: "Lightbulb",
            isPublic: visibility === "public",
        },
    }).catch(() => {});

    return NextResponse.json({ suggestion }, { status: 201 });
}
