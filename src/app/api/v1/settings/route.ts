import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/settings
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await prisma.setting.findMany();

    // Convert to key-value map
    const settingsMap: Record<string, unknown> = {};
    for (const s of settings) {
        settingsMap[s.key] = s.value;
    }

    return NextResponse.json({ settings: settingsMap });
}

// PATCH /api/v1/settings - Bulk update settings
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Upsert each setting
    for (const [key, value] of Object.entries(body)) {
        await prisma.setting.upsert({
            where: { key },
            update: { value: value as any },
            create: { key, value: value as any },
        });
    }

    return NextResponse.json({ message: "Settings updated" });
}
