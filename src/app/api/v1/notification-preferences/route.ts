import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { setPreference, getUserPreferences } from "@/core/lib/notif-prefs";
import { ModuleNotificationTypes } from "@/core/generated/module-notification-types";

/** GET — list current user's prefs + the available event types */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prefs = await getUserPreferences(session.user.id);
    return NextResponse.json({
        types: ModuleNotificationTypes,
        prefs,
    });
}

const updateSchema = z.object({
    eventType: z.string().min(1),
    channel: z.string().min(1),
    enabled: z.boolean(),
});

/** POST — update one preference */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    await setPreference(session.user.id, parsed.data.eventType, parsed.data.channel, parsed.data.enabled);
    return NextResponse.json({ ok: true });
}
