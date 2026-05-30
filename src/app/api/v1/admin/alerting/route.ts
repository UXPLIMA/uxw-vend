import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import {
    HEALTH_ALERTING_SETTING_KEY,
    loadAlertingConfig,
} from "@/core/lib/health-alerting";
import { logActivity } from "@/core/lib/activity-log";
import { hostnameMatchesAllowlist } from "@/core/lib/url-safety";

/**
 * GET  /api/v1/admin/alerting — fetch the current alerting config.
 * POST /api/v1/admin/alerting — replace the alerting config.
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

    const config = await loadAlertingConfig();
    return NextResponse.json({ config });
}

const alertOnSchema = z.array(z.enum(["ok", "degraded", "down"])).min(1);
const bodySchema = z.object({
    enabled: z.boolean(),
    provider: z.enum(["discord", "slack"]),
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

    // If enabled, webhookUrl must be present and match the provider.
    if (parsed.data.enabled && !parsed.data.webhookUrl) {
        return NextResponse.json(
            { error: "Webhook URL is required when alerting is enabled" },
            { status: 400 },
        );
    }
    if (parsed.data.webhookUrl) {
        try {
            const u = new URL(parsed.data.webhookUrl);
            if (parsed.data.provider === "discord") {
                if (!hostnameMatchesAllowlist(u.hostname, ["discord.com", "discordapp.com"])) {
                    return NextResponse.json(
                        { error: "Discord webhook URL must be on discord.com" },
                        { status: 400 },
                    );
                }
            } else {
                if (!hostnameMatchesAllowlist(u.hostname, ["slack.com"])) {
                    return NextResponse.json(
                        { error: "Slack webhook URL must be on slack.com" },
                        { status: 400 },
                    );
                }
            }
        } catch {
            return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
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
            provider: parsed.data.provider,
            alertOn: parsed.data.alertOn,
        },
    }).catch(() => {});

    return NextResponse.json({ ok: true, config: parsed.data });
}
