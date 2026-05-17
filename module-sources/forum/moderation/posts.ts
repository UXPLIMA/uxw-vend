import { prisma } from "@/core/lib/db";
import type { ModerationProvider } from "@/core/generated/module-moderation";

const provider: ModerationProvider = {
    async count() {
        return prisma.forumPost.count({ where: { moderationState: "PENDING" } });
    },

    async list(skip, take) {
        const [rows, total] = await Promise.all([
            prisma.forumPost.findMany({
                where: { moderationState: "PENDING" },
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    author: { select: { id: true, username: true } },
                    topic: { select: { id: true, title: true, slug: true } },
                },
            }),
            prisma.forumPost.count({ where: { moderationState: "PENDING" } }),
        ]);
        return {
            total,
            items: rows.map((r) => ({
                id: r.id,
                author: r.author,
                preview: r.content.slice(0, 200),
                title: r.topic?.title,
                createdAt: r.createdAt,
                href: r.topic ? `/forum/topic/${r.topic.slug || r.topic.id}` : undefined,
            })),
        };
    },

    async bulkUpdate(ids, newState) {
        const result = await prisma.forumPost.updateMany({
            where: { id: { in: ids } },
            data: { moderationState: newState },
        });
        return result.count;
    },
};

export default provider;
