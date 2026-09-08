import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * A few notifications per account, most of them read.
 *
 * The bell shows an unread count and the page filters read from unread, so
 * both have to exist - and an inbox where everything is unread is as
 * unrepresentative as an empty one.
 */
const NOTICES: [string, string, string, string][] = [
    ["Your rank is active", "VIP has been applied to your account.", "success", "/store"],
    ["Ticket answered", "Support replied to your ticket.", "info", "/support"],
    ["New reply", "Someone replied to your forum topic.", "info", "/forum"],
    ["Payment received", "Thanks - your order is complete.", "success", "/store"],
    ["Warning issued", "A moderator issued you a warning.", "warning", "/punishments"],
    ["Suggestion planned", "An idea you voted for is now planned.", "info", "/suggestions"],
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        let made = 0;
        for (const user of ctx.users) {
            for (const [title, message, type, href] of ctx.some(NOTICES, ctx.int(1, 4))) {
                await ctx.create("notification", () => ctx.prisma.notification.create({
                    data: {
                        userId: user.id,
                        title,
                        message,
                        type,
                        href,
                        isRead: ctx.chance(70),
                        createdAt: ctx.daysAgo(20),
                    },
                }));
                made += 1;
            }
        }
        ctx.log(`${made} notifications`);
    },
};
