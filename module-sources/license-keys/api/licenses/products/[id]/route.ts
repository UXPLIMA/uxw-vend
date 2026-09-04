/** Editing or removing one product mapping. */
import { NextRequest, NextResponse } from "next/server";
import { prisma, isAdmin, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { licenseProductPatchSchema } from "../../../../lib/validations";

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
    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const parsed = licenseProductPatchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const fields = parsed.data;

    const data: Record<string, unknown> = {};
    if (fields.productId !== undefined) data.productId = fields.productId;
    if (fields.keysPerUnit !== undefined) data.keysPerUnit = fields.keysPerUnit;
    if (fields.maxActivations !== undefined) data.maxActivations = fields.maxActivations;
    if (fields.validDays !== undefined) data.validDays = fields.validDays ?? null;
    if (fields.prefix !== undefined) data.prefix = fields.prefix || null;

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
