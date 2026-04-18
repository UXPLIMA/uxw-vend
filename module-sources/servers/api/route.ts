import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET() {
    const servers = await prisma.gameServer.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, type: true, host: true, port: true, queryPort: true, isDefault: true, isActive: true, order: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ servers });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const server = await prisma.gameServer.create({
        data: {
            name: body.name,
            type: body.type || "minecraft",
            host: body.host,
            port: body.port || 25565,
            rconPort: body.rconPort || null,
            rconPassword: body.rconPassword || null,
            queryPort: body.queryPort || null,
            isDefault: body.isDefault || false,
            order: body.order || 0,
        },
    });
    return NextResponse.json({ server }, { status: 201 });
}
