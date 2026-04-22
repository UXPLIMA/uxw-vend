import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { themeRegistry } from "@/core/generated/theme-registry";
import { setActiveTheme } from "@/core/lib/theme-state";
import { logActivity } from "@/core/lib/activity-log";

export async function GET() {
    const row = await prisma.themeState.findFirst();
    return NextResponse.json(row ?? { themeId: "flat", mode: "light" });
}

export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let body: { themeId?: unknown; mode?: unknown };
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const themeId = typeof body.themeId === "string" ? body.themeId : null;
    const manifest = themeId ? themeRegistry[themeId] : null;
    if (!manifest) return NextResponse.json({ error: "Unknown theme" }, { status: 404 });

    const mode = typeof body.mode === "string" && manifest.modes.available[body.mode]
        ? body.mode
        : manifest.modes.default;

    await setActiveTheme(themeId!, mode);
    await logActivity({ userId: session.user.id, action: "theme.state.update", entity: "theme", entityId: themeId!, metadata: { mode } }).catch(() => {});
    return NextResponse.json({ ok: true, themeId, mode });
}
