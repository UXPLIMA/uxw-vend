import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { z } from "zod";

const settingKeySchema = z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid setting key format");
const settingValueSchema = z.string().max(10000, "Setting value too long");
const settingsBodySchema = z.record(settingKeySchema, settingValueSchema);

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

    // Validate settings keys and values
    const parsed = settingsBodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid settings data", issues: parsed.error.issues },
            { status: 400 }
        );
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(parsed.data)) {
        await prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }

    return NextResponse.json({ message: "Settings updated" });
}
