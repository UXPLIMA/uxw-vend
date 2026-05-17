import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/store/bulk-discounts/[id] — Update (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.bulkDiscount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Bulk discount not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.minQuantity === "number") data.minQuantity = body.minQuantity;
    if (typeof body.discountPercent === "number") data.discountPercent = body.discountPercent;
    if (typeof body.productId === "string" || body.productId === null) data.productId = body.productId;
    if (typeof body.categoryId === "string" || body.categoryId === null) data.categoryId = body.categoryId;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const updated = await prisma.bulkDiscount.update({ where: { id }, data });
    return NextResponse.json({ bulkDiscount: updated });
}

// DELETE /api/v1/store/bulk-discounts/[id] — Delete (admin)
export async function DELETE(_: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.bulkDiscount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Bulk discount not found" }, { status: 404 });

    await prisma.bulkDiscount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
