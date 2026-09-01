import { sendDiscordWebhook } from "../lib/discord";

interface TicketPayload {
    subject: string;
    priority: string;
    user?: { username: string } | null;
    department?: { name: string } | null;
}

/**
 * Hook listener: fires on `tickets.ticket.opened`.
 * Announces new support tickets on Discord.
 */
export default async function onTicketOpened(payload: TicketPayload): Promise<void> {
    await sendDiscordWebhook("ticket_created", {
        embeds: [{
            title: "New Support Ticket",
            color: 0xf59e0b,
            fields: [
                { name: "Subject", value: payload.subject, inline: true },
                { name: "User", value: payload.user?.username ?? "Deleted user", inline: true },
                ...(payload.department ? [{ name: "Department", value: payload.department.name, inline: true }] : []),
                { name: "Priority", value: payload.priority, inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}
