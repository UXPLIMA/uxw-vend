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
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.discountPercent !== undefined) data.discountPercent = body.discountPercent;
    if (body.commissionPercent !== undefined) data.commissionPercent = body.commissionPercent;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const code = await prisma.creatorCode.update({ where: { id }, data });
    return NextResponse.json({ code });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await prisma.creatorCode.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
