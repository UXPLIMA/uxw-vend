import { prisma } from "@/core/lib/db";
import type { ModerationProvider } from "@/core/generated/module-moderation";

const provider: ModerationProvider = {
    async count() {
        return prisma.forumTopic.count({ where: { moderationState: "PENDING" } });
    },

    async list(skip, take) {
        const [rows, total] = await Promise.all([
            prisma.forumTopic.findMany({
                where: { moderationState: "PENDING" },
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    author: { select: { id: true, username: true } },
                },
            }),
            prisma.forumTopic.count({ where: { moderationState: "PENDING" } }),
        ]);
        return {
            total,
            items: rows.map((r) => ({
                id: r.id,
                author: r.author,
                preview: r.content.slice(0, 200),
                title: r.title,
                createdAt: r.createdAt,
                href: `/forum/topic/${r.slug || r.id}`,
            })),
        };
    },

    async bulkUpdate(ids, newState) {
        const result = await prisma.forumTopic.updateMany({
            where: { id: { in: ids } },
            data: { moderationState: newState },
        });
        return result.count;
    },
};

export default provider;
