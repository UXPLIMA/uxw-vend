import { NextRequest, NextResponse } from "next/server";
import { readJsonBody } from "@/core/lib/api-body";
import { z } from "zod";

/**
 * A saved dashboard arrangement. `saveLayout` drops any widget id it does not
 * recognise, so the ids need no list here - but the shape does need checking:
 * an entry that was not an object reached `w.id` and threw.
 */
const layoutSchema = z.object({
    widgets: z.array(z.object({
        id: z.string().max(128),
        visible: z.boolean().optional(),
        order: z.number().int().min(0).max(1000).optional(),
    })).max(200),
});
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

    const body = await readJsonBody(request, { fallback: null });
    if (body instanceof NextResponse) return body;
    const parsed = layoutSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const widgets: DashboardWidget[] = parsed.data.widgets.map((w) => ({
        id: w.id,
        visible: w.visible ?? true,
        order: w.order ?? 0,
    }));
    await saveLayout(auth.userId, widgets);
    return NextResponse.json({ success: true });
}

export async function DELETE() {
    const auth = await requireAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await resetLayout(auth.userId);
    return NextResponse.json({ success: true });
}
