import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { logActivity } from "@/core/lib/activity-log";

type ModerationType = "blog-comment" | "forum-topic" | "forum-post" | "suggestion";

const TYPES: ModerationType[] = ["blog-comment", "forum-topic", "forum-post", "suggestion"];

function isModerationType(value: string | null): value is ModerationType {
    return value !== null && (TYPES as string[]).includes(value);
}

interface ModerationItem {
    id: string;
    type: ModerationType;
    author: { id: string; username: string } | null;
    preview: string;
    title?: string;
    createdAt: Date;
    href?: string;
}

async function fetchPending(type: ModerationType, skip: number, take: number): Promise<{ items: ModerationItem[]; total: number }> {
    if (type === "blog-comment") {
        const [rows, total] = await Promise.all([
            prisma.blogComment.findMany({
                where: { moderationState: "PENDING" },
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    author: { select: { id: true, username: true } },
                    article: { select: { id: true, title: true, slug: true } },
                },
            }),
            prisma.blogComment.count({ where: { moderationState: "PENDING" } }),
        ]);
        return {
            total,
            items: rows.map((r) => ({
                id: r.id,
                type,
                author: r.author,
                preview: r.content.slice(0, 200),
                title: r.article?.title,
                createdAt: r.createdAt,
                href: r.article?.slug ? `/blog/${r.article.slug}` : undefined,
            })),
        };
    }
    if (type === "forum-topic") {
        const [rows, total] = await Promise.all([
            prisma.forumTopic.findMany({
                where: { moderationState: "PENDING" },
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    author: { select: { id: true, username: true } },
                },
            }),
            prisma.forumTopic.count({ where: { moderationState: "PENDING" } }),
        ]);
        return {
            total,
            items: rows.map((r) => ({
                id: r.id,
                type,
                author: r.author,
                preview: r.content.slice(0, 200),
                title: r.title,
                createdAt: r.createdAt,
                href: `/forum/topic/${r.slug || r.id}`,
            })),
        };
    }
    if (type === "forum-post") {
        const [rows, total] = await Promise.all([
            prisma.forumPost.findMany({
                where: { moderationState: "PENDING" },
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    author: { select: { id: true, username: true } },
                    topic: { select: { id: true, title: true, slug: true } },
                },
            }),
            prisma.forumPost.count({ where: { moderationState: "PENDING" } }),
        ]);
        return {
            total,
            items: rows.map((r) => ({
                id: r.id,
                type,
                author: r.author,
                preview: r.content.slice(0, 200),
                title: r.topic?.title,
                createdAt: r.createdAt,
                href: r.topic ? `/forum/topic/${r.topic.slug || r.topic.id}` : undefined,
            })),
        };
    }
    // suggestion
    const [rows, total] = await Promise.all([
        prisma.suggestion.findMany({
            where: { moderationState: "PENDING" },
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                author: { select: { id: true, username: true } },
            },
        }),
        prisma.suggestion.count({ where: { moderationState: "PENDING" } }),
    ]);
    return {
        total,
        items: rows.map((r) => ({
            id: r.id,
            type,
            author: r.author,
            preview: r.content.slice(0, 200),
            title: r.title,
            createdAt: r.createdAt,
            href: `/suggestions/${r.id}`,
        })),
    };
}

/**
 * GET /api/v1/admin/moderation?type=blog-comment|forum-topic|forum-post|suggestion&page=1
 * Returns pending items across the four moderatable content types.
 * If `type` is omitted, returns pending counts per type.
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const perPage = 20;

    if (!typeParam) {
        // Return counts for each type
        const [blogComment, forumTopic, forumPost, suggestion] = await Promise.all([
            prisma.blogComment.count({ where: { moderationState: "PENDING" } }).catch(() => 0),
            prisma.forumTopic.count({ where: { moderationState: "PENDING" } }).catch(() => 0),
            prisma.forumPost.count({ where: { moderationState: "PENDING" } }).catch(() => 0),
            prisma.suggestion.count({ where: { moderationState: "PENDING" } }).catch(() => 0),
        ]);
        return NextResponse.json({
            counts: {
                "blog-comment": blogComment,
                "forum-topic": forumTopic,
                "forum-post": forumPost,
                "suggestion": suggestion,
            },
        });
    }

    if (!isModerationType(typeParam)) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    try {
        const { items, total } = await fetchPending(typeParam, (page - 1) * perPage, perPage);
        return NextResponse.json({
            items,
            total,
            page,
            pages: Math.max(1, Math.ceil(total / perPage)),
        });
    } catch (err) {
        console.error("[moderation] fetch failed:", err);
        return NextResponse.json({ items: [], total: 0, page: 1, pages: 1 });
    }
}

const actionSchema = z.object({
    ids: z.array(z.string().min(1)).min(1),
    type: z.enum(["blog-comment", "forum-topic", "forum-post", "suggestion"]),
    action: z.enum(["approve", "reject"]),
});

/**
 * POST /api/v1/admin/moderation
 * Body: { ids: string[], type, action: "approve" | "reject" }
 * Bulk-transitions moderationState and logs to ActivityLog.
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    const { ids, type, action } = parsed.data;
    const newState = action === "approve" ? "APPROVED" : "REJECTED";

    let affected = 0;
    try {
        if (type === "blog-comment") {
            const result = await prisma.blogComment.updateMany({
                where: { id: { in: ids } },
                data: { moderationState: newState, isApproved: newState === "APPROVED" },
            });
            affected = result.count;
        } else if (type === "forum-topic") {
            const result = await prisma.forumTopic.updateMany({
                where: { id: { in: ids } },
                data: { moderationState: newState },
            });
            affected = result.count;
        } else if (type === "forum-post") {
            const result = await prisma.forumPost.updateMany({
                where: { id: { in: ids } },
                data: { moderationState: newState },
            });
            affected = result.count;
        } else if (type === "suggestion") {
            const result = await prisma.suggestion.updateMany({
                where: { id: { in: ids } },
                data: { moderationState: newState },
            });
            affected = result.count;
        }
    } catch (err) {
        console.error("[moderation] action failed:", err);
        return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }

    logActivity({
        userId: session.user.id,
        action: `moderation.${action}`,
        entity: type,
        metadata: { ids, count: affected },
    }).catch(() => {});

    return NextResponse.json({ ok: true, affected });
}
