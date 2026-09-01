import { sendDiscordWebhook } from "../lib/discord";

interface UserRegisteredPayload {
    userId: string;
    email: string;
    username: string;
}

/**
 * Hook listener: fires on `user.registered`.
 * Announces new sign-ups on Discord.
 */
export default async function onUserRegistered(payload: UserRegisteredPayload): Promise<void> {
    await sendDiscordWebhook("user_registered", {
        embeds: [{
            title: "New User Registered",
            description: `**${payload.username}** joined the platform`,
            color: 0x8b5cf6,
            fields: [
                { name: "Email", value: payload.email, inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    });
}
