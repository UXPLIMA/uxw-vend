/**
 * Answers `leaderboard.boards` with what the shop can rank: who has spent the
 * most.
 *
 * The leaderboard used to query `Order` itself, which meant that module knew
 * the shop's table, its status vocabulary and that `total` is money. It asks
 * now, and this file is the only place any of that is known.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { prisma } from "@/core/sdk/server";

const BOARD = {
    id: "buyers",
    labelKey: "store.leaderboardBuyers",
    icon: "Crown",
    unit: "currency" as const,
};

const topBuyers: HookHandlerFor<"leaderboard.boards", "filter"> = async (current, context) => {
    if (context.boardId && context.boardId !== BOARD.id) return current;
    if (!context.boardId) return [...current, { ...BOARD, rows: [] }];

    const spend = await prisma.order.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED" },
        _sum: { total: true },
        orderBy: { _sum: { total: "desc" } },
        take: context.limit,
    });

    // `Order.userId` is nullable: a deleted account leaves its orders behind
    // with nobody to credit, and those are not a row on a leaderboard.
    const userIds = spend.map((row) => row.userId).filter((id): id is string => id !== null);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, avatar: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const rows = spend
        .filter((row): row is typeof row & { userId: string } => row.userId !== null)
        .map((row) => ({
            username: byId.get(row.userId)?.username ?? "",
            avatar: byId.get(row.userId)?.avatar ?? null,
            value: Number(row._sum.total ?? 0),
        }))
        .filter((row) => row.username !== "");

    return [...current, { ...BOARD, rows }];
};

export default topBuyers;
