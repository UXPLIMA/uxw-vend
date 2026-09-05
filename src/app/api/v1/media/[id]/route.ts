import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { readJsonBody } from "@/core/lib/api-body";
import { z } from "zod";
import { prismaErrorOrThrow } from "@/core/lib/prisma-errors";

/** The two fields a media item's record may be renamed by. */
const updateMediaSchema = z.object({
    alt: z.string().max(500).optional(),
    filename: z.string().max(255).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/v1/media/[id] - update alt text */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = updateMediaSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const data: Record<string, unknown> = {};
    if (parsed.data.alt !== undefined) data.alt = parsed.data.alt;
    if (parsed.data.filename !== undefined) data.filename = parsed.data.filename;

    try {
        const item = await prisma.mediaItem.update({ where: { id }, data });
        return NextResponse.json(item);
    } catch (err) {
        // An item deleted between the list load and this save is a 404, not a
        // server fault: two admins on the media library is enough to hit it.
        return prismaErrorOrThrow(err);
    }
}

/** DELETE /api/v1/media/[id] - delete record + file from disk (local only) */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
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
            // File may already be gone - non-fatal
        }
    }

    await prisma.mediaItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
