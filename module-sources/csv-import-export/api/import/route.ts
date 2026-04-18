import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";

// POST /api/v1/admin/import?type=...
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const type = request.nextUrl.searchParams.get("type");

    switch (type) {
        default:
            return NextResponse.json({ error: "No import types available. Module-specific imports should use module APIs." }, { status: 400 });
    }
}
