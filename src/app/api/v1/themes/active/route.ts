import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { getActiveThemeId } from "@/core/lib/theme-config";
import { prisma } from "@/core/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const themeId = await getActiveThemeId();
    const row = await prisma.themeCustomization.findUnique({ where: { themeId } });
    const overrides = (row?.overrides && typeof row.overrides === "object" && !Array.isArray(row.overrides))
        ? (row.overrides as Record<string, unknown>)
        : {};

    return NextResponse.json({ themeId, overrides });
}
