import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/core/lib/activity-log";
import { invalidate } from "@/core/lib/cache";
import { sanitizeCustomCss, CSS_SANITIZED_SETTING_KEYS } from "@/core/lib/css-sanitizer";

const settingKeySchema = z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid setting key format");
// Value is a Json column — accept any JSON-serializable value (string, number, boolean, array, object, null)
// Max serialized size: 100KB to prevent abuse
const settingsBodySchema = z.record(settingKeySchema, z.unknown()).refine(
    (data) => JSON.stringify(data).length <= 100_000,
    { message: "Settings payload too large (max 100KB)" }
);

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

    // Upsert each setting. Setting.value is Json; cast through InputJsonValue.
    // String values for CSS-sanitized keys are scrubbed so a compromised
    // admin account cannot persist a payload that breaks out of the <style>
    // tag injected on every public page.
    for (const [key, rawValue] of Object.entries(parsed.data)) {
        const value = CSS_SANITIZED_SETTING_KEYS.has(key)
            ? sanitizeCustomCss(rawValue)
            : rawValue;
        const jsonValue = (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
        await prisma.setting.upsert({
            where: { key },
            update: { value: jsonValue },
            create: { key, value: jsonValue },
        });
    }

    // Drop the cached public-settings payload so clients see fresh values
    // immediately instead of waiting out the 60s TTL.
    await invalidate("public-settings");

    logActivity({
        userId: session.user.id,
        action: "settings.update",
        entity: "setting",
        metadata: { keys: Object.keys(parsed.data) },
    }).catch(() => {});

    return NextResponse.json({ message: "Settings updated" });
}
