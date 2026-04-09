import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import {
    getAvailableWidgets,
    getLayout,
    saveLayout,
    resetLayout,
    type DashboardWidget,
} from "@/core/lib/dashboard-layout";

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
    if (!(await isAdmin(session.user.id))) return { error: "Forbidden", status: 403 as const };
    return { userId: session.user.id };
}

export async function GET() {
    const auth = await requireAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [layout, available] = await Promise.all([
        getLayout(auth.userId),
        getAvailableWidgets(),
    ]);
    return NextResponse.json({ layout, available });
}

export async function POST(request: NextRequest) {
    const auth = await requireAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.widgets)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const widgets: DashboardWidget[] = body.widgets;
    await saveLayout(auth.userId, widgets);
    return NextResponse.json({ success: true });
}

export async function DELETE() {
    const auth = await requireAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await resetLayout(auth.userId);
    return NextResponse.json({ success: true });
}
