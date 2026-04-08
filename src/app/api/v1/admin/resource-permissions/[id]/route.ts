import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { logActivity } from "@/core/lib/activity-log";

type RouteParams = { params: Promise<{ id: string }> };

/** DELETE — revoke a resource permission grant by id */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await prisma.resourcePermission.findUnique({ where: { id } });
    await prisma.resourcePermission.delete({ where: { id } });

    logActivity({
        userId: session.user.id,
        action: "permission.revoke",
        entity: existing?.resource ?? "resource-permission",
        entityId: existing?.resourceId ?? id,
        metadata: existing
            ? {
                  resource: existing.resource,
                  resourceId: existing.resourceId,
                  action: existing.action,
                  principalType: existing.principalType,
                  principalId: existing.principalId,
              }
            : { id },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
}
