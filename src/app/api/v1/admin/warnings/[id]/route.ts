import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

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
    return NextResponse.json({ warning });
}

/** DELETE — permanently remove a warning */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await prisma.userWarning.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
