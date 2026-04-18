import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { sanitizeHtml } from "@/core/lib/sanitize";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Snapshot the previous state before update
    const { recordRevision } = await import("@/core/lib/revisions");
    await recordRevision("changelog.entry", id, existing, "update", session.user.id);

    const patchData: Record<string, unknown> = { ...body };
    if (typeof patchData.content === "string") {
        patchData.content = sanitizeHtml(patchData.content);
    }
    if (patchData.publishAt !== undefined) {
        patchData.publishAt = patchData.publishAt ? new Date(patchData.publishAt as string) : null;
    }
    const entry = await prisma.changelogEntry.update({ where: { id }, data: patchData });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("changelog.entry.updated", entry);

    return NextResponse.json({ entry });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Snapshot the deleted entry for potential restore
    const { recordRevision } = await import("@/core/lib/revisions");
    await recordRevision("changelog.entry", id, existing, "delete", session.user.id);

    await prisma.changelogEntry.delete({ where: { id } });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("changelog.entry.deleted", existing);

    return NextResponse.json({ message: "Deleted" });
}
