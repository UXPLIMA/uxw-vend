import { prisma } from "@/core/sdk/server";

/**
 * File one notification for one person.
 *
 * `title`/`message` are the English sentence, written at the moment the event
 * happened. `titleKey`/`messageKey` and `params` are what let the reader see
 * it in their own language: the bell resolves the key and falls back to the
 * sentence, so a row written before a translation existed, or by a module
 * that ships none, still says something.
 */
export async function createNotification(params: {
    userId: string;
    title: string;
    message: string;
    titleKey?: string;
    messageKey?: string;
    params?: Record<string, string | number>;
    type?: string;
    href?: string;
}) {
    return prisma.notification.create({
        data: {
            userId: params.userId,
            title: params.title,
            message: params.message,
            titleKey: params.titleKey ?? null,
            messageKey: params.messageKey ?? null,
            params: params.params ?? undefined,
            type: params.type || "info",
            href: params.href || null,
        },
    });
}
