import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isStaff } from "@/core/lib/permissions";
import { revokeWarning } from "@/core/lib/warnings";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isStaff(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await revokeWarning(id);
    return NextResponse.json({ ok: true });
}
