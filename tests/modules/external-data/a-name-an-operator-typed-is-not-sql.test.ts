/**
 * Reading a list out of somebody else's database.
 *
 * An operator points this at a database they already have - a game server, a
 * billing system, an old forum - picks a table and some columns, and gets a
 * list on their site. Which means a table name and a column name they typed
 * end up inside a query, and those are the one thing SQL will not let you
 * bind: a placeholder can carry a value, never an identifier. Whatever goes
 * there is concatenated, and concatenation is how this becomes the worst
 * vulnerability on the site.
 *
 * "Only an admin can set it" is not the answer. An admin session is one
 * stolen cookie, and a setting written once is read on every page load
 * forever after. The name has to be safe on its own.
 *
 * So a name is accepted only if it is a name: letters, digits and
 * underscores, starting with a letter, and short. Everything else is refused
 * rather than escaped, because escaping is a thing you can get subtly wrong
 * and refusing is not. What is accepted is then quoted anyway, so a column
 * that happens to be called `order` still works.
 */
import { describe, it, expect } from "vitest";
import { safeIdentifier, buildListQuery } from "@/modules/external-data/lib/query";

describe("a name an operator typed", () => {
    it("is accepted when it is a plain name", () => {
        expect(safeIdentifier("players")).toBe('"players"');
        expect(safeIdentifier("total_kills")).toBe('"total_kills"');
        expect(safeIdentifier("v2_stats")).toBe('"v2_stats"');
    });

    it("is quoted, so a reserved word still works", () => {
        expect(safeIdentifier("order")).toBe('"order"');
        expect(safeIdentifier("select")).toBe('"select"');
    });

    it("is refused when it carries anything that ends the name", () => {
        for (const attempt of [
            'players"; DROP TABLE users; --',
            "players; DELETE FROM users",
            "players--",
            "players/*",
            "players)",
            "players'",
            'players"',
            "players.secret",
        ]) {
            expect(safeIdentifier(attempt), attempt).toBeNull();
        }
    });

    it("is taken with the spaces somebody pasted around it", () => {
        // The only character class that cannot survive the pattern: it is
        // stripped and then the name is matched, so nothing can hide in it.
        expect(safeIdentifier("  players  ")).toBe('"players"');
    });

    it("is refused when it is empty or absurd", () => {
        expect(safeIdentifier("")).toBeNull();
        expect(safeIdentifier("   ")).toBeNull();
        expect(safeIdentifier("1players")).toBeNull();
        expect(safeIdentifier("a".repeat(200))).toBeNull();
    });

    it("is refused for a name that is only unicode that looks like letters", () => {
        // A homoglyph is not a mistake somebody makes by hand.
        expect(safeIdentifier("plaуers")).toBeNull();
    });
});

describe("the query that comes out", () => {
    const source = {
        table: "players",
        columns: ["name", "kills"],
        orderBy: "kills",
        descending: true,
        limit: 10,
    };

    it("selects only the columns that were named", () => {
        const built = buildListQuery(source);
        expect(built).toEqual({
            text: 'SELECT "name", "kills" FROM "players" ORDER BY "kills" DESC LIMIT $1',
            values: [10],
        });
    });

    it("never asks for everything", () => {
        const built = buildListQuery(source);
        expect("text" in built && built.text.includes("*")).toBe(false);
    });

    it("carries the limit as a value, not as text", () => {
        // The one part that can be bound, so it is.
        const built = buildListQuery({ ...source, limit: 500 });
        expect(built).toEqual({ text: expect.stringContaining("LIMIT $1"), values: [500] });
    });

    it("bounds the limit whatever it was given", () => {
        expect(buildListQuery({ ...source, limit: 100000 })).toEqual({
            text: expect.any(String),
            values: [1000],
        });
        expect(buildListQuery({ ...source, limit: 0 })).toEqual({
            text: expect.any(String),
            values: [1],
        });
    });

    it("orders the other way when asked", () => {
        expect(buildListQuery({ ...source, descending: false })).toEqual({
            text: expect.stringContaining('ORDER BY "kills" ASC'),
            values: [10],
        });
    });

    it("leaves out the ordering when nothing was named to order by", () => {
        const built = buildListQuery({ ...source, orderBy: "" });
        expect("text" in built && built.text.includes("ORDER BY")).toBe(false);
    });

    it("refuses to build anything when a name is not a name", () => {
        expect(buildListQuery({ ...source, table: "players; DROP TABLE users" }))
            .toEqual({ refuse: "bad-identifier" });
        expect(buildListQuery({ ...source, columns: ["name", "kills)" ] }))
            .toEqual({ refuse: "bad-identifier" });
        expect(buildListQuery({ ...source, orderBy: "kills DESC, (SELECT 1)" }))
            .toEqual({ refuse: "bad-identifier" });
    });

    it("refuses to build anything with no columns", () => {
        expect(buildListQuery({ ...source, columns: [] })).toEqual({ refuse: "no-columns" });
    });
});
