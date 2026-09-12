/**
 * Answers `leaderboard.boards` with what the forum can rank: who has posted
 * the most.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { prisma } from "@/core/sdk/server";

const BOARD = {
    id: "posters",
    labelKey: "forum.leaderboardPosters",
    icon: "MessageSquare",
    unit: "count" as const,
};

const topPosters: HookHandlerFor<"leaderboard.boards", "filter"> = async (current, context) => {
    if (context.boardId && context.boardId !== BOARD.id) return current;
    if (!context.boardId) return [...current, { ...BOARD, rows: [] }];

    const posts = await prisma.forumPost.groupBy({
        by: ["authorId"],
        _count: true,
        orderBy: { _count: { authorId: "desc" } },
        take: context.limit,
    });

    // `authorId` is nullable: a post whose author is gone has nobody to rank.
    const authorIds = posts.map((row) => row.authorId).filter((id): id is string => id !== null);
    const users = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, username: true, avatar: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const rows = posts
        .filter((row): row is typeof row & { authorId: string } => row.authorId !== null)
        .map((row) => ({
            username: byId.get(row.authorId)?.username ?? "",
            avatar: byId.get(row.authorId)?.avatar ?? null,
            value: row._count,
        }))
        .filter((row) => row.username !== "");

    return [...current, { ...BOARD, rows }];
};

export default topPosters;
