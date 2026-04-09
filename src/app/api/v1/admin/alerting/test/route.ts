import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import {
    buildTestPayload,
    loadAlertingConfig,
    sendHealthWebhook,
} from "@/core/lib/health-alerting";

/**
 * POST /api/v1/admin/alerting/test
 * Sends a sample notification to the configured webhook so admins
 * can verify the URL works before enabling real alerts.
 */
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await loadAlertingConfig();
    if (!config.webhookUrl) {
        return NextResponse.json(
            { error: "No webhook URL configured. Save one first." },
            { status: 400 },
        );
    }

    const payload = buildTestPayload(config);
    const result = await sendHealthWebhook(config, payload);

    if (!result.ok) {
        return NextResponse.json({ error: result.error || "Failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
}
