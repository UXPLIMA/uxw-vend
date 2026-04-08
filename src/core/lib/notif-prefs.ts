import { prisma } from "@/core/lib/db";

/**
 * User notification preferences.
 *
 * Default: a user is opted-IN to every event type and channel unless they
 * have explicitly opted out (a row exists with enabled=false).
 *
 * Modules emit hooks like "blog.article.created" and the in-app or email
 * sender calls shouldNotify(userId, "blog.article.created", "email") before
 * actually delivering. The user-facing toggle grid in /profile lets users
 * mute specific events per channel.
 */

export async function shouldNotify(
    userId: string,
    eventType: string,
    channel: "email" | "inapp" | string
): Promise<boolean> {
    try {
        const pref = await prisma.notificationPreference.findUnique({
            where: {
                userId_eventType_channel: { userId, eventType, channel },
            },
        });
        // Missing row = enabled (default)
        if (!pref) return true;
        return pref.enabled;
    } catch {
        // If the table query fails for any reason, default to allow
        return true;
    }
}

export async function setPreference(
    userId: string,
    eventType: string,
    channel: string,
    enabled: boolean
): Promise<void> {
    await prisma.notificationPreference.upsert({
        where: {
            userId_eventType_channel: { userId, eventType, channel },
        },
        create: { userId, eventType, channel, enabled },
        update: { enabled },
    });
}

export async function getUserPreferences(userId: string) {
    return prisma.notificationPreference.findMany({
        where: { userId },
    });
}
