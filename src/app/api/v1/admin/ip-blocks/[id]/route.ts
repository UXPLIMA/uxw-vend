import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { removeBlock } from "@/core/lib/ip-blocks";
import { logActivity } from "@/core/lib/activity-log";

/**
 * DELETE /api/v1/admin/ip-blocks/[id]
 * Remove a single block by id. Admin-only, audited.
 */
export async function DELETE(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.ipBlock.findUnique({ where: { id } });
    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await removeBlock(id);

    logActivity({
        userId: session.user.id,
        action: "ip-block.delete",
        entity: "ipBlock",
        entityId: id,
        metadata: { ip: existing.ip, scope: existing.scope },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
}
