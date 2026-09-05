import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { queueBroadcast } from "@/core/lib/broadcasts";
import { prismaErrorOrThrow } from "@/core/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const broadcast = await prisma.emailBroadcast.findUnique({ where: { id } });
    if (!broadcast) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ broadcast });
}

/** POST → queue this broadcast (transitions draft → queued) */
export async function POST(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const result = await queueBroadcast(id);
    return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    try {
        await prisma.emailBroadcast.delete({ where: { id } });
    } catch (err) {
        // Deleting a broadcast that is already gone is a 404, not a 500.
        return prismaErrorOrThrow(err);
    }
    return NextResponse.json({ ok: true });
}
