import { prisma } from "@/core/sdk/server";
import type { ModerationProvider } from "@/core/generated/module-moderation";

/**
 * The replies waiting for a moderator.
 *
 * Held behind the board's own switch: an operator who reviews suggestions has
 * not asked to let the replies under them through unread.
 */
const provider: ModerationProvider = {
    async count() {
        return prisma.suggestionComment.count({ where: { moderationState: "PENDING" } });
    },

    async list(skip, take) {
        const [rows, total] = await Promise.all([
            prisma.suggestionComment.findMany({
                where: { moderationState: "PENDING" },
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    author: { select: { id: true, username: true } },
                    suggestion: { select: { id: true, title: true } },
                },
            }),
            prisma.suggestionComment.count({ where: { moderationState: "PENDING" } }),
        ]);
        return {
            total,
            items: rows.map((r) => ({
                id: r.id,
                author: r.author,
                preview: r.content.slice(0, 200),
                title: r.suggestion.title,
                createdAt: r.createdAt,
                href: `/suggestions/${r.suggestion.id}`,
            })),
        };
    },

    async bulkUpdate(ids, newState) {
        const result = await prisma.suggestionComment.updateMany({
            where: { id: { in: ids } },
            data: { moderationState: newState },
        });
        return result.count;
    },
};

export default provider;
