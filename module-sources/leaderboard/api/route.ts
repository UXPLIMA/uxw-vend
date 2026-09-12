import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/core/sdk/server";
import { applyFiltersAsync } from "@/core/sdk";

const LEADERBOARD_TTL_MS = 5 * 60_000;

/**
 * The boards this install can show, and the rows of one of them.
 *
 * This module owns the page and the ranking; it owns none of the data. It
 * used to query the shop's `Order`, the forum's `ForumPost` and the vote
 * module's `VoteLog`, each behind a "is this model installed?" lookup, which
 * is a module reading three tables it does not own and naming three features
 * it does not ship. Adding a fourth ranking meant editing this file.
 *
 * Now a module with something worth ranking answers `leaderboard.boards` and
 * appends its own. Without a boardId the answer is the list of tabs, which
 * costs a module nothing to give; with one, the module that owns that board
 * fills it.
 */
// GET /api/v1/leaderboard?board=<id>&limit=20
export async function GET(request: NextRequest) {
    const boardId = request.nextUrl.searchParams.get("board");
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "20") || 20));

    const boards = await cached(
        `leaderboard:${boardId ?? "index"}:${limit}`,
        LEADERBOARD_TTL_MS,
        () => applyFiltersAsync("leaderboard.boards", [], { boardId, limit }),
    );

    // A board named in the address that nobody offers is not an error: the
    // module that had it may have been uninstalled since the link was made.
    return NextResponse.json({ boards });
}
