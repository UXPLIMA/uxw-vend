import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";

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
    const { title, content, type, isActive, startsAt, endsAt } = body;

    if (!title || !content) {
        return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
        data: {
            title,
            content,
            type: type || "info",
            isActive: isActive ?? true,
            startsAt: startsAt ? new Date(startsAt) : null,
            endsAt: endsAt ? new Date(endsAt) : null,
        },
    });

    await logActivity({
        userId: session.user.id,
        action: "announcement_created",
        metadata: { description: `Created: ${announcement.title}` },
    });

    return NextResponse.json({ announcement }, { status: 201 });
}
