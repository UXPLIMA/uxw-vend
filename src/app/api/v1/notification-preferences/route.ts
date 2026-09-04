import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { rateLimitForRoleAsync } from "@/core/lib/rate-limit";
import { setPreference, getUserPreferences } from "@/core/lib/notif-prefs";
import { ModuleNotificationTypes } from "@/core/generated/module-notification-types";
import { getModuleStates } from "@/core/lib/module-cache";
import { isEnabledIn } from "@/core/lib/module-enabled";
import { readJsonBody } from "@/core/lib/api-body";

/** GET - list current user's prefs + the available event types */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // A disabled module emits nothing, so its event types are toggles that
    // can never fire. Saved preferences are left alone - re-enabling the
    // module brings the type, and the user's choice, straight back.
    const [prefs, moduleStates] = await Promise.all([
        getUserPreferences(session.user.id),
        getModuleStates(),
    ]);
    return NextResponse.json({
        types: ModuleNotificationTypes.filter((t) => isEnabledIn(moduleStates, t.module)),
        prefs,
    });
}

const updateSchema = z.object({
    eventType: z.string().min(1),
    channel: z.string().min(1),
    enabled: z.boolean(),
});

/** POST - update one preference */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await rateLimitForRoleAsync(
        `notif-prefs:${session.user.id}`,
        { maxRequests: 60, windowMs: 60_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    await setPreference(session.user.id, parsed.data.eventType, parsed.data.channel, parsed.data.enabled);
    return NextResponse.json({ ok: true });
}
