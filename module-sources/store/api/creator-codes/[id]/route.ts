import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.creatorCode.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Creator code not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.code === "string") data.code = body.code;
    if (typeof body.creatorId === "string" || body.creatorId === null) data.creatorId = body.creatorId;
    if (typeof body.discountPercent === "number") data.discountPercent = body.discountPercent;
    if (typeof body.commissionPercent === "number") data.commissionPercent = body.commissionPercent;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const code = await prisma.creatorCode.update({ where: { id }, data });
    return NextResponse.json({ code });
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.creatorCode.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Creator code not found" }, { status: 404 });

    await prisma.creatorCode.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
