import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { deleteBackup, getBackupPath } from "@/core/lib/backup";
import { logActivity } from "@/core/lib/activity-log";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/v1/admin/backup/[id]
 * Permanently remove a backup file.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const fullPath = await getBackupPath(id);
    if (!fullPath) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    await deleteBackup(id);

    logActivity({
        userId: session.user.id,
        action: "backup.delete",
        entity: "backup",
        entityId: id,
        metadata: { id },
    }).catch(() => {});

    return NextResponse.json({ message: "Backup deleted" });
}
