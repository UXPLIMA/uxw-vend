import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";
import { sanitizeHtml } from "@/core/lib/sanitize";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) data.content = sanitizeHtml(body.content);
    if (body.type !== undefined) data.type = body.type;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.dismissible !== undefined) data.dismissible = body.dismissible;
    if (body.includePages !== undefined) data.includePages = body.includePages || null;
    if (body.excludePages !== undefined) data.excludePages = body.excludePages || null;
    if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.publishAt !== undefined) data.publishAt = body.publishAt ? new Date(body.publishAt) : null;

    const announcement = await prisma.announcement.update({ where: { id }, data });

    await logActivity({
        userId: session.user.id,
        action: "announcement_updated",
        metadata: { description: `Updated: ${id}` },
    });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("announcements.announcement.updated", announcement);

    return NextResponse.json({ announcement });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.announcement.findUnique({ where: { id } });
    await prisma.announcement.delete({ where: { id } });

    await logActivity({
        userId: session.user.id,
        action: "announcement_deleted",
        metadata: { description: `Deleted: ${id}` },
    });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("announcements.announcement.deleted", existing);

    return NextResponse.json({ message: "Deleted" });
}
