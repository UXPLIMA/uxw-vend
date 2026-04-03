import { prisma } from "./db";

export async function createNotification(params: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    href?: string;
}) {
    return prisma.notification.create({
        data: {
            userId: params.userId,
            title: params.title,
            message: params.message,
            type: params.type || "info",
            href: params.href || null,
        },
    });
}
