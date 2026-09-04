import { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * A per-day count (and optional sum) computed by the database.
 *
 * Five screens drew the same chart the same wrong way: read every row in the
 * window with `findMany`, then bucket them by day in JavaScript. The window is
 * a `period` query parameter capped at 365 days, so an admin opening the store
 * analytics on a site with a year of orders pulled a year of orders into Node
 * to produce 365 numbers. The row count is the site's history; the answer is
 * always at most 366 rows long.
 *
 * `date_trunc` does the same grouping in the database, over an index, and
 * returns one row per day that has any. Callers keep their own zero-filling,
 * because a chart wants a label for every day in the range whether or not
 * anything happened on it.
 *
 * ## The identifiers
 *
 * Prisma's `groupBy` cannot truncate a timestamp, so this is raw SQL, and a
 * table or column name cannot be a bind parameter. Every identifier is
 * therefore checked against `IDENTIFIER` before it is interpolated, and the
 * function throws rather than building SQL it cannot vouch for. Values are
 * always bound.
 */
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;

function ident(name: string, what: string): Prisma.Sql {
    if (!IDENTIFIER.test(name)) {
        throw new Error(`[daily-series] ${what} "${name}" is not a valid identifier`);
    }
    return Prisma.raw(`"${name}"`);
}

export interface DailySeriesOptions {
    /** The table, spelled as Prisma spells the model: "Order", "BlogArticle". */
    table: string;
    /** Rows on or after this instant. */
    since: Date;
    /** Timestamp column to group on. Defaults to the one every model here has. */
    dateColumn?: string;
    /** A numeric column to total per day, when the chart plots money as well as volume. */
    sumColumn?: string;
    /** Extra equality filters, ANDed. Column names are checked; values are bound. */
    equals?: Record<string, string | number | boolean>;
}

export interface DailySeriesRow {
    /** `YYYY-MM-DD`, the same shape the callers key their buckets by. */
    day: string;
    count: number;
    sum: number;
}

export async function dailySeries(options: DailySeriesOptions): Promise<DailySeriesRow[]> {
    const table = ident(options.table, "table");
    const dateColumn = ident(options.dateColumn ?? "createdAt", "date column");
    const sum = options.sumColumn
        ? Prisma.sql`COALESCE(SUM(${ident(options.sumColumn, "sum column")}), 0)`
        : Prisma.sql`0`;

    const conditions: Prisma.Sql[] = [Prisma.sql`${dateColumn} >= ${options.since}`];
    for (const [column, value] of Object.entries(options.equals ?? {})) {
        conditions.push(Prisma.sql`${ident(column, "filter column")} = ${value}`);
    }

    const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint; sum: unknown }>>`
        SELECT date_trunc('day', ${dateColumn}) AS day,
               COUNT(*) AS count,
               ${sum} AS sum
        FROM ${table}
        WHERE ${Prisma.join(conditions, " AND ")}
        GROUP BY 1
        ORDER BY 1 ASC
    `;

    return rows.map((r) => ({
        day: new Date(r.day).toISOString().split("T")[0],
        count: Number(r.count),
        // A Postgres SUM over a numeric column comes back as a string, and a
        // Decimal through some drivers. `Number(decimal)` is NaN; its string
        // form is not.
        sum: r.sum === null || r.sum === undefined ? 0 : Number(String(r.sum)),
    }));
}

/**
 * The labels a chart needs, one per day from `since` to today inclusive.
 *
 * Every caller wrote this loop, and two of them wrote it with an off-by-one.
 */
export function dayLabels(since: Date, days: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i <= days; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        labels.push(d.toISOString().split("T")[0]);
    }
    return labels;
}
