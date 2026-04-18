import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";
import { sanitizeHtml } from "@/core/lib/sanitize";

// GET /api/v1/announcements - Public: active announcements
export async function GET() {
    const now = new Date();

    const announcements = await prisma.announcement.findMany({
        where: {
            isActive: true,
            OR: [
                { startsAt: null },
                { startsAt: { lte: now } },
            ],
            AND: [
                { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
                { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
            ],
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ announcements });
}

// POST /api/v1/announcements - Admin
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { title, content, type, isActive, dismissible, includePages, excludePages, startsAt, endsAt, publishAt } = body;

    if (!title || !content) {
        return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    // Validate publishAt as ISO datetime if provided
    if (publishAt !== undefined && publishAt !== null) {
        if (typeof publishAt !== "string" || isNaN(Date.parse(publishAt))) {
            return NextResponse.json({ error: "Invalid publishAt" }, { status: 400 });
        }
    }

    const announcement = await prisma.announcement.create({
        data: {
            title,
            content: sanitizeHtml(content),
            type: type || "info",
            isActive: isActive ?? true,
            dismissible: dismissible ?? true,
            includePages: includePages || null,
            excludePages: excludePages || null,
            startsAt: startsAt ? new Date(startsAt) : null,
            endsAt: endsAt ? new Date(endsAt) : null,
            publishAt: publishAt ? new Date(publishAt) : null,
        },
    });

    await logActivity({
        userId: session.user.id,
        action: "announcement_created",
        metadata: { description: `Created: ${announcement.title}` },
    });

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("announcements.announcement.created", announcement);

    // Public activity feed entry
    await prisma.activityFeedItem.create({
        data: {
            type: "announcements.announcement.created",
            actorId: session.user.id,
            title: `Announcement: ${announcement.title}`,
            href: `/`,
            icon: "Megaphone",
            isPublic: true,
        },
    }).catch(() => {});

    return NextResponse.json({ announcement }, { status: 201 });
}
