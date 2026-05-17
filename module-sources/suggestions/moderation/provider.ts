import { prisma } from "@/core/lib/db";
import type { ModerationProvider } from "@/core/generated/module-moderation";

const provider: ModerationProvider = {
    async count() {
        return prisma.suggestion.count({ where: { moderationState: "PENDING" } });
    },

    async list(skip, take) {
        const [rows, total] = await Promise.all([
            prisma.suggestion.findMany({
                where: { moderationState: "PENDING" },
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    author: { select: { id: true, username: true } },
                },
            }),
            prisma.suggestion.count({ where: { moderationState: "PENDING" } }),
        ]);
        return {
            total,
            items: rows.map((r) => ({
                id: r.id,
                author: r.author,
                preview: r.content.slice(0, 200),
                title: r.title,
                createdAt: r.createdAt,
                href: `/suggestions/${r.id}`,
            })),
        };
    },

    async bulkUpdate(ids, newState) {
        const result = await prisma.suggestion.updateMany({
            where: { id: { in: ids } },
            data: { moderationState: newState },
        });
        return result.count;
    },
};

export default provider;
