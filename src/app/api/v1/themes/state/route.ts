import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { themeRegistry, defaultThemeId } from "@/core/generated/theme-registry";
import { setActiveTheme } from "@/core/lib/theme-state";
import { logActivity } from "@/core/lib/activity-log";
import { readJsonBody } from "@/core/lib/api-body";
import { z } from "zod";

/** Which installed theme is active, and in which of the modes it declares. */
const themeStateSchema = z.object({
    themeId: z.string().max(64),
    mode: z.string().max(64).optional(),
});

export async function GET() {
    const row = await prisma.themeState.findFirst();
    if (row) return NextResponse.json(row);

    // Fall back to the codegen-derived defaults so the response never
    // references a theme id that isn't actually installed. Hardcoding
    // "flat" violated the motto and broke clients on installations where
    // flat isn't present.
    const manifest = themeRegistry[defaultThemeId];
    return NextResponse.json({
        themeId: defaultThemeId,
        mode: manifest?.modes.default ?? "light",
    });
}

export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await readJsonBody(req);
    if (body instanceof NextResponse) return body;

    const parsed = themeStateSchema.safeParse(body);
    const themeId = parsed.success ? parsed.data.themeId : null;
    const manifest = themeId ? themeRegistry[themeId] : null;
    if (!manifest || !themeId) return NextResponse.json({ error: "Unknown theme" }, { status: 404 });

    const requestedMode = parsed.success ? parsed.data.mode : undefined;
    const mode = requestedMode && manifest.modes.available[requestedMode]
        ? requestedMode
        : manifest.modes.default;

    await setActiveTheme(themeId, mode);
    await logActivity({ userId: session.user.id, action: "theme.state.update", entity: "theme", entityId: themeId, metadata: { mode } }).catch(() => {});
    return NextResponse.json({ ok: true, themeId, mode });
}
