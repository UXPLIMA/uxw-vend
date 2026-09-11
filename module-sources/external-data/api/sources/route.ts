import { NextRequest, NextResponse } from "next/server";
import { cached, prisma } from "@/core/sdk/server";
import { readExternalList } from "../../lib/read";
import { DEFAULT_CONNECTION_KEY } from "../../lib/connection";

/**
 * GET /api/v1/external-data?slug=... - the list, as the other database has it.
 *
 * Cached for as long as the operator said. This reads somebody else's
 * database, so their load is part of the decision as much as ours, and a
 * leaderboard that is a minute stale is a leaderboard.
 *
 * The answer carries only the columns the source names. Nothing here says
 * which database it came from, and a failure says what kind it was and no
 * more; see lib/errors.ts.
 */
export async function GET(request: NextRequest) {
    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const source = await prisma.externalSource.findFirst({ where: { slug, isActive: true } });
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    /*
     * Cached for as long as the operator said, failures included. An external
     * database that is down should not be asked again on every page view, and
     * a minute of staleness costs the same either way: an operator who fixes
     * the connection waits at most that long to see it.
     */
    const answer = await cached(`blysis:external-data:${source.id}`, source.cacheSeconds * 1000, async () => {
        // A source may name its own connection; almost none will, so an
        // empty one means the site's single connection under the name the
        // settings screen writes to.
        const key = source.settingKey.trim() || DEFAULT_CONNECTION_KEY;
        const connection = await prisma.setting.findUnique({ where: { key } });
        const connectionString = typeof connection?.value === "string" ? connection.value.trim() : "";
        if (connectionString === "") {
            return { failed: "not-connected" as const, message: "That source is not connected yet" };
        }
        return readExternalList(connectionString, {
            table: source.table,
            columns: source.columns,
            orderBy: source.orderBy,
            descending: source.descending,
            limit: source.rowLimit,
        });
    });

    if ("failed" in answer) {
        return NextResponse.json(
            { error: answer.message, code: `external_${answer.failed.replace(/-/g, "_")}` },
            { status: answer.failed === "not-connected" ? 503 : 502 },
        );
    }

    return NextResponse.json(
        { title: source.title, columns: source.columns, rows: answer.rows },
        { headers: { "Cache-Control": `public, max-age=${source.cacheSeconds}` } },
    );
}
