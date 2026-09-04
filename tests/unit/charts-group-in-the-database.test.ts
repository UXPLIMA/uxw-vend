// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A chart is at most 366 numbers long. Five screens read the whole history.
 *
 * Core's `/api/v1/stats` and the store, tickets, blog and forum stats routes
 * each drew a per-day chart the same way: `findMany` every row in the window,
 * `select: { createdAt: true }`, then bucket them by day in JavaScript. The
 * window is a `period` query parameter capped at 365 days, so an admin opening
 * the store analytics on a site with a year of orders pulled a year of orders
 * into Node to produce 365 numbers. The row count is the site's history; the
 * answer never grows.
 *
 * `dailySeries` groups in the database. These tests hold both ends: that the
 * helper builds the SQL it claims to and refuses an identifier it cannot
 * vouch for, and that no route goes back to bucketing a table in JavaScript.
 */

const queryRaw = vi.fn();

vi.mock("@/core/lib/db", () => ({
    prisma: {
        $queryRaw: (...args: unknown[]) => queryRaw(...args),
    },
}));

const { dailySeries, dayLabels } = await import("@/core/lib/daily-series");

const root = path.resolve(import.meta.dirname, "../..");

interface SqlFragment { strings: readonly string[]; values: unknown[] }

function isFragment(value: unknown): value is SqlFragment {
    return (
        typeof value === "object" &&
        value !== null &&
        Array.isArray((value as SqlFragment).strings) &&
        Array.isArray((value as SqlFragment).values)
    );
}

/**
 * The SQL a tagged `$queryRaw` template carries, with its bind parameters
 * listed apart. Nested `Prisma.sql` fragments are spliced in; anything that is
 * not a fragment is a bound value and shows up as `?`, which is what lets the
 * tests below assert that a value never reached the SQL text.
 */
function flatten(strings: readonly string[], values: unknown[]): { sql: string; values: unknown[] } {
    let sql = "";
    const bound: unknown[] = [];
    strings.forEach((chunk, i) => {
        sql += chunk;
        if (i >= values.length) return;
        const value = values[i];
        if (isFragment(value)) {
            const inner = flatten(value.strings, value.values);
            sql += inner.sql;
            bound.push(...inner.values);
        } else {
            sql += "?";
            bound.push(value);
        }
    });
    return { sql, values: bound };
}

function lastQuery(): { sql: string; values: unknown[] } {
    const [strings, ...values] = queryRaw.mock.calls.at(-1) as [readonly string[], ...unknown[]];
    const flat = flatten(strings, values);
    return { sql: flat.sql.replace(/\s+/g, " ").trim(), values: flat.values };
}

beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]);
});

describe("dailySeries", () => {
    it("groups by day in the database", async () => {
        await dailySeries({ table: "Ticket", since: new Date("2026-01-01T00:00:00Z") });
        const { sql } = lastQuery();
        expect(sql).toContain("date_trunc('day'");
        expect(sql).toContain("GROUP BY 1");
        expect(sql).toContain('FROM "Ticket"');
    });

    it("binds the date rather than pasting it into the SQL", async () => {
        const since = new Date("2026-01-01T00:00:00Z");
        await dailySeries({ table: "Ticket", since });
        const { sql, values } = lastQuery();
        expect(values).toContain(since);
        expect(sql).not.toContain("2026-01-01");
    });

    it("binds a filter value and quotes its column", async () => {
        await dailySeries({ table: "Order", since: new Date(), equals: { status: "COMPLETED" } });
        const { sql, values } = lastQuery();
        expect(sql).toContain('"status"');
        expect(values).toContain("COMPLETED");
        expect(sql).not.toContain("COMPLETED");
    });

    it("sums a column when the chart plots money too", async () => {
        await dailySeries({ table: "Order", since: new Date(), sumColumn: "total" });
        expect(lastQuery().sql).toContain('SUM("total")');
    });

    it("reads no sum when none was asked for", async () => {
        await dailySeries({ table: "Ticket", since: new Date() });
        expect(lastQuery().sql).not.toContain("SUM(");
    });

    it("returns days as YYYY-MM-DD and counts as numbers, not bigints", async () => {
        queryRaw.mockResolvedValue([
            { day: new Date("2026-03-04T00:00:00Z"), count: BigInt(7), sum: "12.5" },
        ]);
        await expect(dailySeries({ table: "Ticket", since: new Date() })).resolves.toEqual([
            { day: "2026-03-04", count: 7, sum: 12.5 },
        ]);
    });

    it("reads a Decimal sum, which Number() alone turns into NaN", async () => {
        const decimal = { toString: () => "42.75" };
        queryRaw.mockResolvedValue([{ day: new Date("2026-03-04T00:00:00Z"), count: BigInt(1), sum: decimal }]);
        const [row] = await dailySeries({ table: "Order", since: new Date(), sumColumn: "total" });
        expect(row.sum).toBe(42.75);
    });

    it("reads a missing sum as zero", async () => {
        queryRaw.mockResolvedValue([{ day: new Date("2026-03-04T00:00:00Z"), count: BigInt(1), sum: null }]);
        const [row] = await dailySeries({ table: "Ticket", since: new Date() });
        expect(row.sum).toBe(0);
    });

    it("refuses a table name it cannot vouch for", async () => {
        for (const table of ['Order"; DROP TABLE "User', "orders order", "1Order", ""]) {
            await expect(dailySeries({ table, since: new Date() })).rejects.toThrow(/identifier/);
        }
        expect(queryRaw).not.toHaveBeenCalled();
    });

    it("refuses an injected column name in every position that takes one", async () => {
        const bad = 'createdAt" = 1 OR "1';
        await expect(dailySeries({ table: "Ticket", since: new Date(), dateColumn: bad })).rejects.toThrow(/identifier/);
        await expect(dailySeries({ table: "Ticket", since: new Date(), sumColumn: bad })).rejects.toThrow(/identifier/);
        await expect(
            dailySeries({ table: "Ticket", since: new Date(), equals: { [bad]: "x" } }),
        ).rejects.toThrow(/identifier/);
    });
});

describe("dayLabels", () => {
    it("covers both ends of the range", () => {
        const labels = dayLabels(new Date("2026-01-01T00:00:00Z"), 3);
        expect(labels).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    });

    it("returns one label for a zero-day range", () => {
        expect(dayLabels(new Date("2026-01-01T00:00:00Z"), 0)).toEqual(["2026-01-01"]);
    });
});

describe("no route buckets a table in JavaScript", () => {
    const scanned = ["src/app", "src/core", "module-sources"];

    function tsFiles(dir: string, out: string[] = []): string[] {
        if (!fs.existsSync(dir)) return out;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === "node_modules") continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) tsFiles(full, out);
            else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
        }
        return out;
    }

    /** The whole `findMany(...)` call text, brackets balanced. */
    function callText(source: string, openParen: number): string {
        let depth = 0;
        for (let i = openParen; i < source.length; i++) {
            if (source[i] === "(") depth++;
            else if (source[i] === ")") {
                depth--;
                if (depth === 0) return source.slice(openParen, i + 1);
            }
        }
        return source.slice(openParen);
    }

    const files = scanned.flatMap((dir) => tsFiles(path.join(root, dir)));

    it("scans the whole product", () => {
        expect(files.length).toBeGreaterThan(400);
    });

    it("reads no date window row by row", () => {
        const offenders: string[] = [];
        for (const file of files) {
            const source = fs.readFileSync(file, "utf8");
            for (const m of source.matchAll(/prisma\.\w+\s*\.findMany\s*\(/g)) {
                const text = callText(source, m.index + m[0].length - 1);
                // The shape that was wrong five times over: a date lower bound,
                // no `take`, and a projection narrow enough that the rows are
                // only ever going to be counted.
                const windowed = /createdAt:\s*\{\s*gte:/.test(text) || /publishedAt:\s*\{\s*gte:/.test(text);
                const projection = /select:\s*\{[^}]*(createdAt|publishedAt):\s*true/.test(text);
                if (!windowed || !projection) continue;
                if (/\btake\b\s*:/.test(text)) continue;
                offenders.push(`${path.relative(root, file)}:${source.slice(0, m.index).split("\n").length}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("has every stats route reach for the helper instead", () => {
        const statsRoutes = [
            "src/app/api/v1/stats/route.ts",
            "module-sources/store/api/stats/route.ts",
            "module-sources/tickets/api/stats/route.ts",
            "module-sources/blog/api/stats/route.ts",
            "module-sources/forum/api/stats/route.ts",
        ];
        for (const rel of statsRoutes) {
            const source = fs.readFileSync(path.join(root, rel), "utf8");
            expect(source, `${rel} does not group in the database`).toContain("dailySeries(");
        }
    });

    it("keeps the helper reachable from a module, which is where four of them live", () => {
        const sdk = fs.readFileSync(path.join(root, "src/core/sdk/server.ts"), "utf8");
        expect(sdk).toContain("dailySeries");
        expect(sdk).toContain("dayLabels");
    });
});
