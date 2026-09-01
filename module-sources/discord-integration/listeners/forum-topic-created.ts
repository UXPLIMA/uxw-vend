import { sendDiscordWebhook } from "../lib/discord";

interface TopicPayload {
    title: string;
    author?: { username: string } | null;
    category?: { name: string } | null;
}

/**
 * Hook listener: fires on `forum.topic.created`.
 * Announces new forum topics on Discord.
 */
export default async function onForumTopicCreated(payload: TopicPayload): Promise<void> {
    await sendDiscordWebhook("forum_topic_created", {
        embeds: [{
            title: "New Forum Topic",
            color: 0x6366f1,
            fields: [
                { name: "Title", value: payload.title, inline: true },
                { name: "Author", value: payload.author?.username ?? "Deleted user", inline: true },
                { name: "Category", value: payload.category?.name || "General", inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}
