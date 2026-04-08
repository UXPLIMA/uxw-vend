import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { createBackup, listBackups, formatBytes } from "@/core/lib/backup";

/**
 * GET /api/v1/admin/backup
 * List all available backups. Admin only.
 *
 * Response shape includes both structured `BackupMeta` fields and the legacy
 * `size` / `sizeHuman` / `createdAt` (string) fields so the older admin/system
 * page keeps working unchanged.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const backups = await listBackups();
        const serialised = backups.map((b) => ({
            id: b.id,
            filename: b.filename,
            type: b.type,
            sizeBytes: b.sizeBytes,
            // Legacy fields for admin/system page compatibility
            size: b.sizeBytes,
            sizeHuman: formatBytes(b.sizeBytes),
            createdAt: b.createdAt.toISOString(),
            notes: b.notes ?? null,
        }));
        return NextResponse.json({ backups: serialised, total: serialised.length });
    } catch {
        return NextResponse.json({ error: "Failed to list backups" }, { status: 500 });
    }
}

/**
 * POST /api/v1/admin/backup
 * Create a new manual backup. Body is optional: { notes?: string }.
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let notes: string | undefined;
    try {
        const body = await request.json().catch(() => null);
        if (body && typeof body.notes === "string") {
            notes = body.notes.slice(0, 500);
        }
    } catch {
        // empty body → just proceed
    }

    try {
        const meta = await createBackup("manual", notes);
        return NextResponse.json(
            {
                message: "Backup created",
                backup: {
                    id: meta.id,
                    filename: meta.filename,
                    type: meta.type,
                    sizeBytes: meta.sizeBytes,
                    size: meta.sizeBytes,
                    sizeHuman: formatBytes(meta.sizeBytes),
                    createdAt: meta.createdAt.toISOString(),
                    notes: meta.notes ?? null,
                },
            },
            { status: 201 },
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : "Backup failed";
        // Scrub any accidental password leak defensively
        const safe = message.replace(/(password|PGPASSWORD)=[^\s]+/gi, "$1=***");
        return NextResponse.json({ error: `Backup failed: ${safe}` }, { status: 500 });
    }
}
