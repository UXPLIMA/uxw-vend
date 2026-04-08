import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

/** DELETE — revoke a specific session (must belong to current user) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const sess = await prisma.userSession.findUnique({ where: { id } });
    if (!sess || sess.userId !== session.user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.userSession.update({
        where: { id },
        data: { isRevoked: true },
    });

    return NextResponse.json({ ok: true });
}
