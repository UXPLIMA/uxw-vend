import { NextRequest, NextResponse } from "next/server";
import { cached, prisma } from "@/core/sdk/server";

interface LeaderboardEntry {
    username: string;
    avatar: string | null;
    value: number;
    count?: number;
}

const LEADERBOARD_TTL_MS = 5 * 60_000; // 5 minutes

/**
 * The board ranks what the site actually has.
 *
 * Votes and forum posts belong to the `vote` and `forum` modules, and this
 * module depends on neither: a store leaderboard is useful on a site with no
 * forum, and saying otherwise would drag both modules onto every install that
 * wants one. Prisma's generated client only carries a model while the module
 * that declares it is installed, so those two tables are reached through a
 * lookup that can come back empty rather than as a property that has to exist.
 * Without this the whole app fails to compile on any install that left one of
 * them out, which is most of them.
 */
interface GroupByCountDelegate<K extends string> {
    groupBy(args: {
        by: K[];
        _count: true;
        orderBy: Record<string, Record<string, "desc">>;
        take: number;
    }): Promise<Array<Record<K, string | null> & { _count: number }>>;
}

function optionalModel<K extends string>(model: string): GroupByCountDelegate<K> | null {
    const delegate = (prisma as unknown as Record<string, unknown>)[model];
    return delegate ? (delegate as GroupByCountDelegate<K>) : null;
}

/** Turns grouped counts into named rows, resolving each user once. */
async function rank(
    rows: ReadonlyArray<Record<string, unknown> & { _count: number }>,
    field: string,
): Promise<LeaderboardEntry[]> {
    const ids = rows
        .map((r) => r[field])
        .filter((id): id is string => typeof id === "string");
    const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, username: true, avatar: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    return rows
        .filter((r) => typeof r[field] === "string")
        .map((r) => {
            const user = userById.get(r[field] as string);
            return {
                username: user?.username || "Unknown",
                avatar: user?.avatar ?? null,
                value: r._count,
            };
        });
}

async function buildBuyers(limit: number): Promise<LeaderboardEntry[]> {
    const orders = await prisma.order.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED" },
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: "desc" } },
        take: limit,
    });

    // Order.userId is nullable (SetNull on user deletion). Filter out
    // anonymized orders from the leaderboard - there's no user to credit.
    const userIds = orders.map((o) => o.userId).filter((id): id is string => id !== null);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, avatar: true },
    });
    // O(1) lookup Map instead of .find() per row (was O(n²)).
    const userById = new Map(users.map((u) => [u.id, u]));

    return orders
        .filter((o): o is typeof o & { userId: string } => o.userId !== null)
        .map((o) => {
            const user = userById.get(o.userId);
            return {
                username: user?.username || "Unknown",
                avatar: user?.avatar ?? null,
                value: Number(o._sum.total || 0),
                count: o._count,
            };
        });
}

async function buildVoters(limit: number): Promise<LeaderboardEntry[]> {
    const voteLog = optionalModel<"userId">("voteLog");
    if (!voteLog) return [];

    const votes = await voteLog.groupBy({
        by: ["userId"],
        _count: true,
        orderBy: { _count: { userId: "desc" } },
        take: limit,
    });

    return rank(votes, "userId");
}

async function buildForum(limit: number): Promise<LeaderboardEntry[]> {
    const forumPost = optionalModel<"authorId">("forumPost");
    if (!forumPost) return [];

    const posts = await forumPost.groupBy({
        by: ["authorId"],
        _count: true,
        orderBy: { _count: { authorId: "desc" } },
        take: limit,
    });

    // ForumPost.authorId is nullable (SetNull on user deletion), so a post
    // whose author is gone has nobody to credit.
    return rank(posts, "authorId");
}

/** The boards this install can actually fill. */
function availableSources(): string[] {
    const sources = ["buyers"];
    if (optionalModel("voteLog")) sources.push("voters");
    if (optionalModel("forumPost")) sources.push("forum");
    return sources;
}

// GET /api/v1/leaderboard?type=buyers|voters|forum
export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get("type") || "buyers";
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "10") || 20));

    // Told to the client so it can offer only the boards that exist rather
    // than a tab that is permanently empty.
    const sources = availableSources();
    const cacheKey = `leaderboard:${type}:${limit}`;

    const builders: Record<string, (n: number) => Promise<LeaderboardEntry[]>> = {
        buyers: buildBuyers,
        voters: buildVoters,
        forum: buildForum,
    };

    const build = builders[type];
    if (!build) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // A known board whose module is not installed answers with an empty list,
    // not an error: nothing about the request was wrong.
    const leaderboard = sources.includes(type)
        ? await cached<LeaderboardEntry[]>(cacheKey, LEADERBOARD_TTL_MS, () => build(limit))
        : [];

    return NextResponse.json({ type, leaderboard, sources });
}
