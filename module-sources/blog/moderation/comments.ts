import { prisma } from "@/core/lib/db";
import type { ModerationProvider } from "@/core/generated/module-moderation";

const provider: ModerationProvider = {
    async count() {
        return prisma.blogComment.count({ where: { moderationState: "PENDING" } });
    },

    async list(skip, take) {
        const [rows, total] = await Promise.all([
            prisma.blogComment.findMany({
                where: { moderationState: "PENDING" },
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    author: { select: { id: true, username: true } },
                    article: { select: { id: true, title: true, slug: true } },
                },
            }),
            prisma.blogComment.count({ where: { moderationState: "PENDING" } }),
        ]);
        return {
            total,
            items: rows.map((r) => ({
                id: r.id,
                author: r.author,
                preview: r.content.slice(0, 200),
                title: r.article?.title,
                createdAt: r.createdAt,
                href: r.article?.slug ? `/blog/${r.article.slug}` : undefined,
            })),
        };
    },

    async bulkUpdate(ids, newState) {
        const result = await prisma.blogComment.updateMany({
            where: { id: { in: ids } },
            data: { moderationState: newState, isApproved: newState === "APPROVED" },
        });
        return result.count;
    },
};

export default provider;
