/**
 * What an operator is allowed to save as a source.
 *
 * `query.ts` refuses a table or column name that is not a plain name, and
 * writes down why at length: an identifier is the one thing SQL will not let
 * you bind, so whatever goes there is concatenated, and refusing is the only
 * thing you cannot get subtly wrong.
 *
 * That leaves the save. A screen that accepts a name the reader will refuse
 * stores a source that is listed, looks configured, and answers an error to
 * every visitor for ever - a control that appears to work and does not, and
 * the operator finds out from a page rather than from the form they filled in.
 * The two have to agree, so the save asks the same function.
 *
 * The agreement is checked in both directions here, because the dangerous
 * drift is the one nobody would notice: a save that grows looser than the
 * reader is a table full of names waiting for somebody to "fix" the reader by
 * escaping them instead of refusing them.
 */
import { describe, it, expect } from "vitest";
import { buildListQuery } from "@/modules/external-data/lib/query";
import { checkSourceDraft } from "@/modules/external-data/lib/source-draft";

const draft = (over: Partial<Parameters<typeof checkSourceDraft>[0]> = {}) => ({
    slug: "leaderboard",
    title: "Top players",
    table: "players",
    columns: ["name", "score"],
    orderBy: "score",
    rowLimit: 20,
    cacheSeconds: 60,
    ...over,
});

describe("a source an operator may save", () => {
    it("takes plain names", () => {
        expect(checkSourceDraft(draft())).toBeNull();
    });

    it("takes one with no ordering, which leaves it to the database", () => {
        expect(checkSourceDraft(draft({ orderBy: "" }))).toBeNull();
    });

    it("refuses a table name that is not a name", () => {
        expect(checkSourceDraft(draft({ table: "users; DROP TABLE users" }))).toBe("bad_table");
        expect(checkSourceDraft(draft({ table: "public.users" }))).toBe("bad_table");
        expect(checkSourceDraft(draft({ table: "" }))).toBe("bad_table");
    });

    it("refuses a column name that is not a name", () => {
        expect(checkSourceDraft(draft({ columns: ["name", "score) --"] }))).toBe("bad_column");
        expect(checkSourceDraft(draft({ columns: ["name", "*"] }))).toBe("bad_column");
    });

    it("refuses a source with no columns, because a select needs one", () => {
        expect(checkSourceDraft(draft({ columns: [] }))).toBe("no_columns");
    });

    it("refuses an ordering column that is not a name", () => {
        expect(checkSourceDraft(draft({ orderBy: "score DESC, id" }))).toBe("bad_order");
    });

    it("refuses a slug that is not an address", () => {
        expect(checkSourceDraft(draft({ slug: "Top Players" }))).toBe("bad_slug");
        expect(checkSourceDraft(draft({ slug: "" }))).toBe("bad_slug");
    });

    it("refuses a title nobody wrote", () => {
        expect(checkSourceDraft(draft({ title: "   " }))).toBe("no_title");
    });
});

describe("the save and the reader agree", () => {
    const names = [
        "players", "Players", "player_scores", "x1",
        "users; DROP TABLE users", "public.users", "*", "", "  ",
        "select", "order", "1players", "player-scores", "pläyers",
        "a".repeat(63), "a".repeat(64),
    ];

    for (const name of names) {
        it(`agrees about the table name ${JSON.stringify(name)}`, () => {
            const saved = checkSourceDraft(draft({ table: name })) === null;
            const built = buildListQuery({
                table: name,
                columns: ["name"],
                orderBy: "",
                descending: true,
                limit: 20,
            });
            expect(saved).toBe(!("refuse" in built));
        });
    }

    it("never stores a source the reader would refuse to run", () => {
        // The direction that matters: everything accepted here builds.
        for (const table of names) {
            for (const column of names) {
                if (checkSourceDraft(draft({ table, columns: [column], orderBy: "" })) !== null) continue;
                const built = buildListQuery({
                    table, columns: [column], orderBy: "", descending: true, limit: 20,
                });
                expect("refuse" in built, `${table} / ${column} saved but does not build`).toBe(false);
            }
        }
    });
});
