/**
 * Answers `leaderboard.boards` with what this module can rank: who has voted
 * most often.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { prisma } from "@/core/sdk/server";

const BOARD = {
    id: "voters",
    labelKey: "vote.leaderboardVoters",
    icon: "Medal",
    unit: "count" as const,
};

const topVoters: HookHandlerFor<"leaderboard.boards", "filter"> = async (current, context) => {
    if (context.boardId && context.boardId !== BOARD.id) return current;
    if (!context.boardId) return [...current, { ...BOARD, rows: [] }];

    const votes = await prisma.voteLog.groupBy({
        by: ["userId"],
        _count: true,
        orderBy: { _count: { userId: "desc" } },
        take: context.limit,
    });

    const userIds = votes.map((row) => row.userId).filter((id): id is string => id !== null);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, avatar: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const rows = votes
        .filter((row): row is typeof row & { userId: string } => row.userId !== null)
        .map((row) => ({
            username: byId.get(row.userId)?.username ?? "",
            avatar: byId.get(row.userId)?.avatar ?? null,
            value: row._count,
        }))
        .filter((row) => row.username !== "");

    return [...current, { ...BOARD, rows }];
};

export default topVoters;
