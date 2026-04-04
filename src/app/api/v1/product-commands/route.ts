import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import moduleSystem from "@/core/lib/modules";

// GET ?productId=xxx
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const configs = await prisma.moduleConfig.findMany({ select: { id: true, enabled: true, config: true } });
    await moduleSystem.initialize(configs.map(c => ({ id: c.id, enabled: c.enabled, config: c.config as Record<string, unknown> })));
    if (!moduleSystem.isEnabled("store")) return NextResponse.json({ error: "Store module is disabled" }, { status: 404 });

    const productId = request.nextUrl.searchParams.get("productId");
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const commands = await prisma.productCommand.findMany({
        where: { productId },
        orderBy: { order: "asc" },
    });
    return NextResponse.json({ commands });
}

// POST
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { productId, command, order } = await request.json();
    if (!productId || !command) return NextResponse.json({ error: "productId and command required" }, { status: 400 });

    const cmd = await prisma.productCommand.create({
        data: { productId, command, order: order || 0 },
    });
    return NextResponse.json({ command: cmd }, { status: 201 });
}
