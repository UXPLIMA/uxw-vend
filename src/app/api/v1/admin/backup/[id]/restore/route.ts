import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { restoreBackup, getBackupPath } from "@/core/lib/backup";
import { logActivity } from "@/core/lib/activity-log";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admin/backup/[id]/restore
 *
 * DANGEROUS — replaces the live database with the contents of the backup.
 * Requires BOTH:
 *   - admin role
 *   - one of: `?confirm=true` query OR body `{ confirmText: "RESTORE" }`
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    // Confirmation gate — the URL flag OR the body token
    const url = new URL(req.url);
    const confirmQuery = url.searchParams.get("confirm") === "true";

    let confirmBody = false;
    try {
        const body = await req.json().catch(() => null);
        if (body && typeof body.confirmText === "string" && body.confirmText === "RESTORE") {
            confirmBody = true;
        }
    } catch {
        // ignore – body may be empty
    }

    if (!confirmQuery && !confirmBody) {
        return NextResponse.json(
            { error: "Restore requires confirmation: POST with body {confirmText: 'RESTORE'} or ?confirm=true" },
            { status: 400 },
        );
    }

    const fullPath = await getBackupPath(id);
    if (!fullPath) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const result = await restoreBackup(id);
    if (!result.success) {
        const safe = (result.error ?? "Restore failed").replace(/(password|PGPASSWORD)=[^\s]+/gi, "$1=***");
        return NextResponse.json({ error: safe, success: false }, { status: 500 });
    }

    logActivity({
        userId: session.user.id,
        action: "backup.restore",
        entity: "backup",
        entityId: id,
        metadata: { id },
    }).catch(() => {});

    return NextResponse.json({ message: "Database restored successfully", success: true });
}
