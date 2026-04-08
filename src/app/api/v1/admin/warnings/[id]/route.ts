import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { logActivity } from "@/core/lib/activity-log";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH — revoke (soft-disable) a warning by setting isActive=false */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const warning = await prisma.userWarning.update({
        where: { id },
        data: { isActive: false },
    });

    logActivity({
        userId: session.user.id,
        action: "warning.revoke",
        entity: "user",
        entityId: warning.userId,
        metadata: { warningId: warning.id },
    }).catch(() => {});

    return NextResponse.json({ warning });
}

/** DELETE — permanently remove a warning */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await prisma.userWarning.findUnique({ where: { id } });
    await prisma.userWarning.delete({ where: { id } });

    logActivity({
        userId: session.user.id,
        action: "warning.delete",
        entity: "user",
        entityId: existing?.userId,
        metadata: { warningId: id },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
}
