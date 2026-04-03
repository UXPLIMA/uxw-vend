import { prisma } from "./db";

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

// Event types that can trigger webhooks
export type WebhookEvent =
    | "order.completed"
    | "order.created"
    | "ticket.created"
    | "ticket.replied"
    | "user.registered"
    | "forum.topic.created";

// Get webhook URL for an event from settings
async function getWebhookUrl(event: WebhookEvent): Promise<string | null> {
    // Check event-specific webhook first, then fallback to general
    const specificKey = `discord_webhook_${event.replace(/\./g, "_")}`;
    const generalKey = "discord_webhook_general";

    const settings = await prisma.setting.findMany({
        where: { key: { in: [specificKey, generalKey] } },
    });

    const specific = settings.find((s) => s.key === specificKey);
    if (specific && typeof specific.value === "string" && specific.value.startsWith("http")) {
        return specific.value;
    }

    const general = settings.find((s) => s.key === generalKey);
    if (general && typeof general.value === "string" && general.value.startsWith("http")) {
        return general.value;
    }

    // Fallback to env
    return process.env.DISCORD_WEBHOOK_URL || null;
}

// Send a webhook to Discord
async function sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
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

// ---- Event handlers ----

export async function notifyOrderCompleted(order: {
    orderNumber: string;
    total: number;
    username: string;
    itemCount: number;
}) {
    const url = await getWebhookUrl("order.completed");
    if (!url) return;

    await sendWebhook(url, {
        embeds: [{
            title: "New Purchase!",
            description: `**${order.username}** completed an order`,
            color: 0x22c55e, // green
            fields: [
                { name: "Order", value: order.orderNumber, inline: true },
                { name: "Total", value: `$${order.total.toFixed(2)}`, inline: true },
                { name: "Items", value: String(order.itemCount), inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}

export async function notifyOrderCreated(order: {
    orderNumber: string;
    total: number;
    username: string;
}) {
    const url = await getWebhookUrl("order.created");
    if (!url) return;

    await sendWebhook(url, {
        embeds: [{
            title: "New Order",
            description: `**${order.username}** placed an order`,
            color: 0x3b82f6, // blue
            fields: [
                { name: "Order", value: order.orderNumber, inline: true },
                { name: "Total", value: `$${order.total.toFixed(2)}`, inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}

export async function notifyTicketCreated(ticket: {
    subject: string;
    username: string;
    department: string;
    priority: string;
}) {
    const url = await getWebhookUrl("ticket.created");
    if (!url) return;

    const priorityColors: Record<string, number> = {
        LOW: 0x6b7280,
        MEDIUM: 0x3b82f6,
        HIGH: 0xf97316,
        URGENT: 0xef4444,
    };

    await sendWebhook(url, {
        embeds: [{
            title: "New Support Ticket",
            description: ticket.subject,
            color: priorityColors[ticket.priority] || 0x6b7280,
            fields: [
                { name: "From", value: ticket.username, inline: true },
                { name: "Department", value: ticket.department, inline: true },
                { name: "Priority", value: ticket.priority, inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}

export async function notifyUserRegistered(user: {
    username: string;
    email: string;
}) {
    const url = await getWebhookUrl("user.registered");
    if (!url) return;

    await sendWebhook(url, {
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

export async function notifyForumTopicCreated(topic: {
    title: string;
    username: string;
    category: string;
}) {
    const url = await getWebhookUrl("forum.topic.created");
    if (!url) return;

    await sendWebhook(url, {
        embeds: [{
            title: "New Forum Topic",
            description: `**${topic.username}** started a discussion`,
            color: 0x06b6d4, // cyan
            fields: [
                { name: "Topic", value: topic.title, inline: false },
                { name: "Category", value: topic.category, inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}
