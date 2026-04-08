import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

// POST /api/v1/admin/email-queue/[id]/retry - Reset a failed job to pending
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    const existing = await prisma.emailJob.findUnique({ where: { id } });
    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.emailJob.update({
        where: { id },
        data: {
            status: "pending",
            attempts: 0,
            lastError: null,
            scheduledAt: new Date(),
        },
    });

    return NextResponse.json({ ok: true, job: { id: updated.id, status: updated.status } });
}
