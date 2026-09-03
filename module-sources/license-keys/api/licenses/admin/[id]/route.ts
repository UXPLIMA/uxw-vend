/** Revoking, restoring, or deleting one key. */
import { NextRequest, NextResponse } from "next/server";
import { prisma, isAdmin, logActivity } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

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
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.status === "active" || body.status === "revoked") data.status = body.status;
    if (body.note !== undefined) data.note = typeof body.note === "string" ? body.note : null;
    if (body.maxActivations !== undefined) {
        data.maxActivations = Math.max(1, Number(body.maxActivations) || 1);
    }
    if (body.expiresAt !== undefined) {
        data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
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
