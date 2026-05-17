import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.color !== undefined) data.color = body.color;
    if (typeof body.points === "number") data.points = body.points;
    if (body.awardOn !== undefined) data.awardOn = body.awardOn;
    const trophy = await prisma.trophy.update({ where: { id }, data });
    return NextResponse.json({ trophy });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await prisma.trophy.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
