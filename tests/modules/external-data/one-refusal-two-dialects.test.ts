/**
 * Reading a list out of MySQL as well as out of Postgres.
 *
 * Most of the servers this module points at run MySQL, and the two speak
 * different SQL in the two places this file touches: an identifier is `"name"`
 * in one and `` `name` `` in the other, and a bound value is `$1` in one and
 * `?` in the other.
 *
 * The quoting is the dangerous half. It would be easy to keep one builder and
 * escape per dialect, and escaping is the thing `query.ts` was written to
 * avoid: a name is refused unless it is a name, because refusing is the thing
 * you cannot get subtly wrong. So the refusal has to be exactly one decision
 * shared by both, and only the quotes may differ - otherwise a name MySQL
 * accepts and Postgres does not is a source that works on half the installs,
 * and the next person to fix that reaches for an escape.
 *
 * The one that would bite is the backtick. It closes an identifier in MySQL
 * and means nothing in Postgres, so a builder that only ever ran against
 * Postgres could carry one for years. `safeIdentifier` never let it through -
 * it allows letters, digits and underscores and nothing else - and this holds
 * that true from the MySQL side too.
 */
import { describe, it, expect } from "vitest";
import { buildListQuery, safeIdentifier } from "@/modules/external-data/lib/query";

const source = {
    table: "players",
    columns: ["name", "score"],
    orderBy: "score",
    descending: true,
    limit: 20,
};

describe("the same names are refused whichever dialect is asking", () => {
    const names = [
        "players", "Players", "player_scores", "x1", "select", "order",
        "users; DROP TABLE users", "public.users", "*", "", "   ",
        "a`b", "a\"b", "a'b", "a\\b", "a b", "1players", "pläyers",
        "a".repeat(63), "a".repeat(64),
    ];

    for (const name of names) {
        it(`agrees about ${JSON.stringify(name)}`, () => {
            const postgres = buildListQuery({ ...source, table: name }, "postgres");
            const mysql = buildListQuery({ ...source, table: name }, "mysql");
            expect("refuse" in mysql).toBe("refuse" in postgres);
        });
    }

    it("refuses a backtick, which would close an identifier in MySQL", () => {
        expect(safeIdentifier("a`b", "mysql")).toBeNull();
        expect(safeIdentifier("a`b", "postgres")).toBeNull();
    });

    it("refuses a double quote, which would close one in Postgres", () => {
        expect(safeIdentifier("a\"b", "mysql")).toBeNull();
        expect(safeIdentifier("a\"b", "postgres")).toBeNull();
    });
});

describe("what each dialect is handed", () => {
    it("quotes an identifier the way that dialect quotes one", () => {
        expect(safeIdentifier("order", "postgres")).toBe('"order"');
        expect(safeIdentifier("order", "mysql")).toBe("`order`");
    });

    it("binds the limit the way that dialect binds one", () => {
        const postgres = buildListQuery(source, "postgres");
        const mysql = buildListQuery(source, "mysql");
        if ("refuse" in postgres || "refuse" in mysql) throw new Error("both should build");
        expect(postgres.text).toContain("LIMIT $1");
        expect(mysql.text).toContain("LIMIT ?");
        expect(postgres.values).toEqual([20]);
        expect(mysql.values).toEqual([20]);
    });

    it("names the same columns in the same order either way", () => {
        const postgres = buildListQuery(source, "postgres");
        const mysql = buildListQuery(source, "mysql");
        if ("refuse" in postgres || "refuse" in mysql) throw new Error("both should build");
        expect(postgres.text).toContain('SELECT "name", "score" FROM "players"');
        expect(mysql.text).toContain("SELECT `name`, `score` FROM `players`");
    });

    it("orders the same way either way", () => {
        const built = buildListQuery({ ...source, descending: false }, "mysql");
        if ("refuse" in built) throw new Error("should build");
        expect(built.text).toContain("ORDER BY `score` ASC");
    });

    it("still holds the row limit down whichever dialect asks", () => {
        for (const dialect of ["postgres", "mysql"] as const) {
            const built = buildListQuery({ ...source, limit: 999_999 }, dialect);
            if ("refuse" in built) throw new Error("should build");
            expect(built.values[0]).toBeLessThanOrEqual(1000);
        }
    });
});

describe("which dialect a connection string is", () => {
    it("reads the scheme rather than guessing", async () => {
        const { dialectOf } = await import("@/modules/external-data/lib/dialect");
        expect(dialectOf("postgres://u:p@h:5432/db")).toBe("postgres");
        expect(dialectOf("postgresql://u:p@h:5432/db")).toBe("postgres");
        expect(dialectOf("mysql://u:p@h:3306/db")).toBe("mysql");
        expect(dialectOf("mariadb://u:p@h:3306/db")).toBe("mysql");
    });

    it("says nothing for a string that names no scheme it knows", async () => {
        const { dialectOf } = await import("@/modules/external-data/lib/dialect");
        // Refused rather than defaulted: a connection string for a database
        // nothing here can read should say so, not open a Postgres socket to
        // whatever host it names.
        expect(dialectOf("mongodb://u:p@h/db")).toBeNull();
        expect(dialectOf("h:5432/db")).toBeNull();
        expect(dialectOf("")).toBeNull();
    });
});
