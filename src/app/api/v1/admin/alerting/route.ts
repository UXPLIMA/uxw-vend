import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import {
    HEALTH_ALERTING_SETTING_KEY,
    listAlertingChannels,
    loadAlertingConfig,
} from "@/core/lib/health-alerting";
import { logActivity } from "@/core/lib/activity-log";
import { resolveWebhookChannel, validateWebhookUrl } from "@/core/lib/webhook-channels";

/**
 * GET  /api/v1/admin/alerting - fetch the current alerting config.
 * POST /api/v1/admin/alerting - replace the alerting config.
 *
 * Config is stored in Setting { key: "health_alerting" }.
 */

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { session };
}

export async function GET() {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    const [config, channels] = await Promise.all([loadAlertingConfig(), listAlertingChannels()]);
    // The admin form renders the channel picker from this list - core has no
    // built-in vendor list to hardcode into the page.
    return NextResponse.json({ config, channels });
}

const alertOnSchema = z.array(z.enum(["ok", "degraded", "down"])).min(1);
const bodySchema = z.object({
    enabled: z.boolean(),
    channel: z.string().min(1).max(64),
    webhookUrl: z.string().url().or(z.literal("")),
    alertOn: alertOnSchema,
});

export async function POST(request: NextRequest) {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message || "Invalid", issues: parsed.error.issues },
            { status: 400 },
        );
    }

    // If enabled, webhookUrl must be present and acceptable to the channel.
    if (parsed.data.enabled && !parsed.data.webhookUrl) {
        return NextResponse.json(
            { error: "Webhook URL is required when alerting is enabled" },
            { status: 400 },
        );
    }

    const channels = await listAlertingChannels();
    if (!channels.some((c) => c.id === parsed.data.channel)) {
        return NextResponse.json({ error: "Unknown webhook channel" }, { status: 400 });
    }

    if (parsed.data.webhookUrl) {
        const check = validateWebhookUrl(
            resolveWebhookChannel(parsed.data.channel, channels),
            parsed.data.webhookUrl,
        );
        if (!check.ok) {
            return NextResponse.json({ error: check.error }, { status: 400 });
        }
    }

    const value = parsed.data as unknown as Prisma.InputJsonValue;
    await prisma.setting.upsert({
        where: { key: HEALTH_ALERTING_SETTING_KEY },
        update: { value },
        create: { key: HEALTH_ALERTING_SETTING_KEY, value, module: "core" },
    });

    logActivity({
        userId: guard.session?.user?.id,
        action: "alerting.update",
        entity: "setting",
        entityId: HEALTH_ALERTING_SETTING_KEY,
        metadata: {
            enabled: parsed.data.enabled,
            channel: parsed.data.channel,
            alertOn: parsed.data.alertOn,
        },
    }).catch(() => {});

    return NextResponse.json({ ok: true, config: parsed.data });
}
