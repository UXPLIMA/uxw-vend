import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { Prisma } from "@prisma/client";
import { themeRegistry } from "@/core/generated/theme-registry";
import { logActivity } from "@/core/lib/activity-log";
import { sanitizeCustomCss } from "@/core/lib/css-sanitizer";

function sanitizeOverrides(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
            out[k] = sanitizeCustomCss(v);
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
            out[k] = sanitizeOverrides(v as Record<string, unknown>);
        } else {
            out[k] = v;
        }
    }
    return out;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id: themeId } = await ctx.params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!themeRegistry[themeId]) {
        return NextResponse.json({ error: "Unknown theme" }, { status: 404 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const overrides = (body as { overrides?: unknown })?.overrides;
    if (overrides === undefined || overrides === null) {
        return NextResponse.json({ error: "overrides is required" }, { status: 400 });
    }
    if (typeof overrides !== "object" || Array.isArray(overrides)) {
        return NextResponse.json({ error: "overrides must be an object" }, { status: 400 });
    }
    if (JSON.stringify(overrides).length > 100_000) {
        return NextResponse.json({ error: "overrides payload too large" }, { status: 413 });
    }

    const safe = sanitizeOverrides(overrides as Record<string, unknown>);

    if (Object.keys(safe).length === 0) {
        await prisma.themeCustomization.deleteMany({ where: { themeId } });
    } else {
        await prisma.themeCustomization.upsert({
            where: { themeId },
            create: { themeId, overrides: safe as Prisma.InputJsonValue, updatedById: session.user.id },
            update: { overrides: safe as Prisma.InputJsonValue, updatedById: session.user.id },
        });
    }

    logActivity({
        userId: session.user.id,
        action: "theme.customization.update",
        entity: "theme",
        entityId: themeId,
        metadata: { fields: Object.keys(safe) },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
}
