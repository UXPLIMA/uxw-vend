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
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.host !== undefined) data.host = body.host;
    if (body.port !== undefined) data.port = body.port;
    if (body.rconPort !== undefined) data.rconPort = body.rconPort;
    if (body.rconPassword !== undefined) data.rconPassword = body.rconPassword;
    if (body.queryPort !== undefined) data.queryPort = body.queryPort;
    if (body.isDefault !== undefined) data.isDefault = body.isDefault;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.order !== undefined) data.order = body.order;
    const server = await prisma.gameServer.update({ where: { id }, data });
    return NextResponse.json({ server });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await prisma.gameServer.delete({ where: { id } });
    return NextResponse.json({ message: "Server deleted" });
}
