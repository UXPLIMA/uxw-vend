/** Editing or removing one product mapping. */
import { NextRequest, NextResponse } from "next/server";
import { prisma, isAdmin } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

interface RouteParams {
    params: Promise<{ id: string }>;
}

async function denyUnlessAdmin(): Promise<NextResponse | null> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return null;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.productId === "string" && body.productId.trim()) data.productId = body.productId.trim();
    if (body.keysPerUnit !== undefined) data.keysPerUnit = Math.max(1, Number(body.keysPerUnit) || 1);
    if (body.maxActivations !== undefined) data.maxActivations = Math.max(1, Number(body.maxActivations) || 1);
    if (body.validDays !== undefined) data.validDays = body.validDays ? Math.max(1, Number(body.validDays)) : null;
    if (body.prefix !== undefined) data.prefix = body.prefix || null;

    const product = await prisma.licenseProduct.update({ where: { id }, data });
    return NextResponse.json({ product });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;

    const { id } = await params;
    // Keys already issued stay valid. Removing the mapping only stops new ones.
    await prisma.licenseProduct.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
