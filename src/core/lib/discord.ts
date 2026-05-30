import { prisma } from "./db";
import { hostnameMatchesAllowlist } from "./url-safety";

interface DiscordEmbed {
    title?: string;
    description?: string;
    color?: number;
    fields?: { name: string; value: string; inline?: boolean }[];
    footer?: { text: string };
    timestamp?: string;
    thumbnail?: { url: string };
}

interface WebhookPayload {
    content?: string;
    embeds?: DiscordEmbed[];
    username?: string;
    avatar_url?: string;
}

/**
 * Generic Discord webhook sender.
 *
 * Modules call this with their own event type key.
 * The webhook URL is resolved from settings:
 *   1. `discord_webhook_{eventType}` (dots replaced with underscores)
 *   2. `discord_webhook_general` fallback
 *   3. DISCORD_WEBHOOK_URL env var fallback
 *
 * Example usage from a module:
 *   sendDiscordWebhook("order_completed", { embeds: [...] })
 *   sendDiscordWebhook("ticket_created", { embeds: [...] })
 */
export async function sendDiscordWebhook(
    eventType: string,
    payload: WebhookPayload
): Promise<void> {
    const specificKey = `discord_webhook_${eventType.replace(/\./g, "_")}`;
    const generalKey = "discord_webhook_general";

    const settings = await prisma.setting.findMany({
        where: { key: { in: [specificKey, generalKey] } },
    });

    const specific = settings.find((s) => s.key === specificKey);
    let url: string | null = null;

    if (specific && typeof specific.value === "string" && specific.value.startsWith("http")) {
        url = specific.value;
    } else {
        const general = settings.find((s) => s.key === generalKey);
        if (general && typeof general.value === "string" && general.value.startsWith("http")) {
            url = general.value;
        } else {
            url = process.env.DISCORD_WEBHOOK_URL || null;
        }
    }

    if (!url) return;

    // Validate webhook domain
    try {
        const urlObj = new URL(url);
        if (!hostnameMatchesAllowlist(urlObj.hostname, ['discord.com', 'discordapp.com'])) {
            console.warn('[Discord] Invalid webhook domain:', urlObj.hostname);
            return;
        }
    } catch { return; }

    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                username: payload.username || "uxwVend",
            }),
        });
    } catch (err) {
        console.error("[Discord Webhook] Failed to send:", err);
    }
}

// ---- Core event: user registration (auth system, not module-specific) ----

export async function notifyUserRegistered(user: {
    username: string;
    email: string;
}) {
    await sendDiscordWebhook("user_registered", {
        embeds: [{
            title: "New User Registered",
            description: `**${user.username}** joined the platform`,
            color: 0x8b5cf6, // purple
            fields: [
                { name: "Email", value: user.email, inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}
