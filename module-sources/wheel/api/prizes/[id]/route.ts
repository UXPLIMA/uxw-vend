import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH - Admin: update prize
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.value !== undefined) data.value = Number(body.value) || 0;
    if (body.color !== undefined) data.color = body.color;
    if (body.probability !== undefined) data.probability = Number(body.probability) || 10;
    if (body.order !== undefined) data.order = Number(body.order) || 0;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const prize = await prisma.wheelPrize.update({ where: { id }, data });
    return NextResponse.json({ prize });
}

// DELETE - Admin: delete prize
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await prisma.wheelPrize.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
