/** Revoking, restoring, or deleting one key. */
import { NextRequest, NextResponse } from "next/server";
import { prisma, isAdmin, logActivity, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { licensePatchSchema } from "../../../../lib/validations";

interface RouteParams {
    params: Promise<{ id: string }>;
}

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return { userId: session.user.id };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const parsed = licensePatchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const fields = parsed.data;
    const data: Record<string, unknown> = {};

    if (fields.status !== undefined) data.status = fields.status;
    if (fields.note !== undefined) data.note = fields.note ?? null;
    if (fields.maxActivations !== undefined) data.maxActivations = fields.maxActivations;
    if (fields.expiresAt !== undefined) {
        data.expiresAt = fields.expiresAt ? new Date(fields.expiresAt) : null;
    }

    const license = await prisma.licenseKey.update({ where: { id }, data });

    if (data.status) {
        await logActivity({
            userId: guard.userId,
            action: `license.${data.status === "revoked" ? "revoked" : "restored"}`,
            entity: "license",
            entityId: id,
            metadata: { keyHint: license.keyHint },
        }).catch(() => undefined);
    }

    return NextResponse.json({ license: { id: license.id, status: license.status } });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    // Activations go with it - the relation is onDelete: Cascade.
    await prisma.licenseKey.delete({ where: { id } });
    await logActivity({
        userId: guard.userId,
        action: "license.deleted",
        entity: "license",
        entityId: id,
    }).catch(() => undefined);
    return NextResponse.json({ ok: true });
}
