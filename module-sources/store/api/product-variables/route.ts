import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import moduleSystem from "@/core/lib/modules";

// GET ?productId=xxx (public for checkout, admin for all)
export async function GET(request: NextRequest) {
    const configs = await prisma.moduleConfig.findMany({ select: { id: true, enabled: true, config: true } });
    await moduleSystem.initialize(configs.map(c => ({ id: c.id, enabled: c.enabled, config: c.config as Record<string, unknown> })));
    if (!moduleSystem.isEnabled("store")) return NextResponse.json({ error: "Store module is disabled" }, { status: 404 });

    const productId = request.nextUrl.searchParams.get("productId");
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const variables = await prisma.productVariable.findMany({
        where: { productId },
    });
    return NextResponse.json({ variables });
}

// POST - Admin
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { productId, name, label, type, required, placeholder, options } = await request.json();
    if (!productId || !name || !label) return NextResponse.json({ error: "productId, name, label required" }, { status: 400 });

    const variable = await prisma.productVariable.create({
        data: {
            productId, name, label,
            type: type || "text",
            required: required ?? true,
            placeholder: placeholder || null,
            options: options || null,
        },
    });
    return NextResponse.json({ variable }, { status: 201 });
}
