import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { wheelSchema } from "../../../lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

/** 401 when nobody is signed in, 403 when they are and may not do this. */
async function refuse(): Promise<NextResponse | null> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return null;
}

// PATCH /api/v1/wheel/wheels/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const refused = await refuse();
    if (refused) return refused;

    const { id } = await params;
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    const parsed = wheelSchema.partial().safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { roleId, ...fields } = parsed.data;
    const wheel = await prisma.wheel.update({
        where: { id },
        data: {
            ...fields,
            ...(roleId === undefined ? {} : { roleIds: roleId ? [roleId] : [] }),
        },
    });
    return NextResponse.json({ wheel });
}

// DELETE /api/v1/wheel/wheels/[id]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const refused = await refuse();
    if (refused) return refused;

    const { id } = await params;
    // The prizes go with it (the row owns them); the spins stay, with their
    // wheel set to null, because a person's history is not the operator's to
    // delete along with a wheel they retired.
    await prisma.wheel.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
}
