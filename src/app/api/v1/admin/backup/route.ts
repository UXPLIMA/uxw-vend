import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { createBackup, listBackups, formatBytes } from "@/core/lib/backup";
import { isAutomatedBackupEnabled, setAutomatedBackupEnabled } from "@/core/lib/backup-schedule";
import { logActivity } from "@/core/lib/activity-log";
import { readJsonBody } from "@/core/lib/api-body";
import { z } from "zod";

/** An optional note filed alongside a manual backup. */
const backupBodySchema = z.object({ notes: z.string().max(500).optional() });

/** The one thing the screen can change about the nightly job: whether it runs. */
const scheduleBodySchema = z.object({ automated: z.boolean() });

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
        return NextResponse.json({
            backups: serialised,
            total: serialised.length,
            // The screen shows whether the nightly job is running, so it reads
            // the answer from the same place the job does rather than assuming.
            automated: { enabled: await isAutomatedBackupEnabled() },
        });
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
        const body = await readJsonBody(request, { fallback: null });
        if (body instanceof NextResponse) return body;
        const parsed = backupBodySchema.safeParse(body);
        if (parsed.success && parsed.data.notes) notes = parsed.data.notes;
    } catch {
        // empty body → just proceed
    }

    try {
        const meta = await createBackup("manual", notes);

        logActivity({
            userId: session.user.id,
            action: "backup.create",
            entity: "backup",
            entityId: meta.id,
            metadata: { id: meta.id, filename: meta.filename, sizeBytes: meta.sizeBytes, notes: meta.notes ?? null },
        }).catch(() => {});

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

/**
 * PATCH /api/v1/admin/backup
 * Switch the nightly backup on or off. Body: { automated: boolean }.
 *
 * An operator who dumps the database from outside the application has no use
 * for this job, and before this the only state open to them was one failed run
 * a night.
 */
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    const parsed = scheduleBodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
    }

    await setAutomatedBackupEnabled(parsed.data.automated);

    logActivity({
        userId: session.user.id,
        action: parsed.data.automated ? "backup.schedule.enable" : "backup.schedule.disable",
        entity: "backup",
    });

    return NextResponse.json({ automated: { enabled: parsed.data.automated } });
}
