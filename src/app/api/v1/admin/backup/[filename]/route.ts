import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import fs from "fs";
import fsAsync from "fs/promises";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

function sanitizeFilename(name: string): string | null {
    // Only allow uxwvend_*.zip or uxwvend_*.sql or uxwvend_*.sql.gz
    if (!/^uxwvend_[\w-]+\.(zip|sql|sql\.gz)$/.test(name)) return null;
    if (name.includes("..") || name.includes("/")) return null;
    return name;
}

type RouteParams = { params: Promise<{ filename: string }> };

// GET /api/v1/admin/backup/[filename] — Download backup file
export async function GET(_req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { filename } = await params;
    const safe = sanitizeFilename(filename);
    if (!safe) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

    const filePath = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Backup not found" }, { status: 404 });

    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);

    const readableStream = new ReadableStream({
        start(controller) {
            stream.on("data", (chunk) => controller.enqueue(chunk));
            stream.on("end", () => controller.close());
            stream.on("error", (err) => controller.error(err));
        },
    });

    return new NextResponse(readableStream, {
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${safe}"`,
            "Content-Length": String(stat.size),
        },
    });
}

// DELETE /api/v1/admin/backup/[filename] — Delete a backup
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { filename } = await params;
    const safe = sanitizeFilename(filename);
    if (!safe) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

    const filePath = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Backup not found" }, { status: 404 });

    await fsAsync.unlink(filePath);
    return NextResponse.json({ message: "Backup deleted" });
}
