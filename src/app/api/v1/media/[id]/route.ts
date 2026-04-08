import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/v1/media/[id] — update alt text */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.alt === "string") data.alt = body.alt;
    if (typeof body.filename === "string") data.filename = body.filename;

    const item = await prisma.mediaItem.update({ where: { id }, data });
    return NextResponse.json(item);
}

/** DELETE /api/v1/media/[id] — delete record + file from disk (local only) */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const item = await prisma.mediaItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Best-effort delete from local filesystem (S3 deletes left for V2)
    if (item.url.startsWith("/uploads/")) {
        try {
            const localPath = path.join(process.cwd(), "public", item.url);
            await fs.unlink(localPath);
        } catch {
            // File may already be gone — non-fatal
        }
    }

    await prisma.mediaItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
