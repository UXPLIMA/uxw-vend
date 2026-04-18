import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { sanitizeHtml } from "@/core/lib/sanitize";
import { z } from "zod";

export async function GET() {
    const now = new Date();
    const entries = await prisma.changelogEntry.findMany({
        where: {
            isActive: true,
            OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const schema = z.object({
        version: z.string().min(1).max(50),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(10000),
        type: z.string().max(50).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        publishAt: z.string().datetime().optional().nullable(),
    });
    const validation = schema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });

    const { version, title, content, type, color, publishAt } = validation.data;

    const entry = await prisma.changelogEntry.create({
        data: {
            version,
            title,
            content: sanitizeHtml(content),
            type: type || "update",
            color: color || "#3b82f6",
            publishAt: publishAt ? new Date(publishAt) : null,
        },
    });

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("changelog.entry.published", entry);

    // Public activity feed entry
    await prisma.activityFeedItem.create({
        data: {
            type: "changelog.entry.published",
            actorId: session.user.id,
            title: `Changelog ${entry.version}: ${entry.title}`,
            href: `/changelog`,
            icon: "GitBranch",
            isPublic: true,
        },
    }).catch(() => {});

    return NextResponse.json({ entry }, { status: 201 });
}
