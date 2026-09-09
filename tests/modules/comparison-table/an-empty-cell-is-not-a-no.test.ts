/**
 * A table for choosing between things, and the cell nobody filled in.
 *
 * The shop already had a comparison of its ranks. It was built by splitting
 * each product's description on newlines, treating every line as a feature,
 * and then drawing a red cross in every cell where one rank's list did not
 * contain another rank's line. So a rank whose description was a paragraph had
 * one feature and a cross against everything else, and a visitor deciding what
 * to pay for was told, in a red mark, that it lacked things nobody had ever
 * said either way.
 *
 * That is the failure this table exists to avoid, and it is one decision: a
 * cell an operator has not filled in is unstated, and unstated is not "no".
 * The three are different to a reader - yes, no, and no comment - and only two
 * of them are a claim.
 *
 * The rest is order. A table read top to bottom is groups in the order the
 * operator set, rows inside them likewise, and everything ungrouped after,
 * because a row that lost its group must not silently disappear.
 */
import { describe, it, expect } from "vitest";
import { buildGrid } from "@/modules/comparison-table/lib/grid";

const columns = [
    { id: "basic", label: "Basic", order: 0 },
    { id: "plus", label: "Plus", order: 1 },
];

const groups = [{ id: "g1", label: "Storage", order: 0 }];

const rows = [
    { id: "r1", groupId: "g1", label: "Space", order: 0 },
    { id: "r2", groupId: "g1", label: "Backups", order: 1 },
];

describe("what a cell says", () => {
    it("says yes where an operator said yes", () => {
        const grid = buildGrid(columns, groups, rows, [
            { rowId: "r1", columnId: "basic", kind: "yes", value: null },
        ]);
        expect(grid.groups[0].rows[0].cells[0]).toEqual({ columnId: "basic", kind: "yes", value: null });
    });

    it("says no where an operator said no", () => {
        const grid = buildGrid(columns, groups, rows, [
            { rowId: "r1", columnId: "basic", kind: "no", value: null },
        ]);
        expect(grid.groups[0].rows[0].cells[0].kind).toBe("no");
    });

    it("carries a number or a word where that is the answer", () => {
        const grid = buildGrid(columns, groups, rows, [
            { rowId: "r1", columnId: "basic", kind: "value", value: "10 GB" },
        ]);
        expect(grid.groups[0].rows[0].cells[0]).toEqual({ columnId: "basic", kind: "value", value: "10 GB" });
    });

    it("says nothing at all where nobody filled it in", () => {
        // The whole point. A cross here is a claim the operator never made.
        const grid = buildGrid(columns, groups, rows, []);
        expect(grid.groups[0].rows[0].cells).toEqual([
            { columnId: "basic", kind: "unstated", value: null },
            { columnId: "plus", kind: "unstated", value: null },
        ]);
    });

    it("says nothing where a value was left blank", () => {
        // "value" with nothing in it is a box somebody opened and closed.
        const grid = buildGrid(columns, groups, rows, [
            { rowId: "r1", columnId: "basic", kind: "value", value: "   " },
        ]);
        expect(grid.groups[0].rows[0].cells[0].kind).toBe("unstated");
    });
});

describe("the shape of the grid", () => {
    it("gives every row one cell per column, in the columns' order", () => {
        const grid = buildGrid(columns, groups, rows, [
            { rowId: "r1", columnId: "plus", kind: "yes", value: null },
        ]);
        expect(grid.groups[0].rows[0].cells.map((cell) => cell.columnId)).toEqual(["basic", "plus"]);
        expect(grid.groups[0].rows[0].cells[1].kind).toBe("yes");
    });

    it("ignores a cell pointing at a column that has gone", () => {
        const grid = buildGrid(columns, groups, rows, [
            { rowId: "r1", columnId: "deleted", kind: "yes", value: null },
        ]);
        expect(grid.groups[0].rows[0].cells.every((cell) => cell.kind === "unstated")).toBe(true);
    });

    it("puts the groups and their rows in the order they were given", () => {
        // Declared out of order on purpose: what decides the reading order is
        // the number the operator set, not the order they happen to be read
        // out of the database.
        const two = [{ id: "g2", label: "Support", order: 1 }, { id: "g1", label: "Storage", order: 0 }];
        const inBoth = [...rows, { id: "r4", groupId: "g2", label: "Hours", order: 0 }];
        const grid = buildGrid(columns, two, inBoth, []);
        expect(grid.groups.map((group) => group.label)).toEqual(["Storage", "Support"]);
        expect(grid.groups[0].rows.map((row) => row.label)).toEqual(["Space", "Backups"]);
    });

    it("keeps a row whose group has gone, rather than losing it", () => {
        // A deleted group must not take rows off the page with it: the
        // operator would be comparing on a feature that silently vanished.
        const orphan = [...rows, { id: "r3", groupId: "gone", label: "Uptime", order: 0 }];
        const grid = buildGrid(columns, groups, orphan, []);
        const ungrouped = grid.groups.find((group) => group.id === null);
        expect(ungrouped?.rows.map((row) => row.label)).toEqual(["Uptime"]);
    });

    it("puts the ungrouped rows last", () => {
        const orphan = [...rows, { id: "r3", groupId: null, label: "Uptime", order: 0 }];
        const grid = buildGrid(columns, groups, orphan, []);
        expect(grid.groups[grid.groups.length - 1].id).toBeNull();
    });

    it("draws no empty group", () => {
        const grid = buildGrid(columns, [...groups, { id: "g9", label: "Nothing", order: 9 }], rows, []);
        expect(grid.groups.map((group) => group.label)).toEqual(["Storage"]);
    });
});
