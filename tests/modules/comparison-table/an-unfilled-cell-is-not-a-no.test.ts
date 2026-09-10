/**
 * What a save writes, and the cell the operator never answered.
 *
 * `buildGrid` already decided that a cell with no row behind it is unstated,
 * and that unstated is not "no": three answers are different to somebody
 * choosing what to pay for, and only two of them are a claim. A cross drawn
 * for the third tells them a thing lacks a feature nobody ever said either
 * way.
 *
 * An editor is where that decision gets undone. A grid of tri-state controls
 * has a value for every intersection whether or not anybody touched it, and
 * the obvious save writes all of them. Every blank becomes a stored "no", and
 * the table starts making claims about products on the operator's behalf. The
 * writing half has to keep the reading half's promise, so the row is dropped
 * rather than stored, and an unstated cell stays a gap all the way through.
 *
 * The value box has the same shape one layer in. A box somebody opened and
 * closed holds an empty string, which is not an answer either, and `stated`
 * already refuses to draw one. Refusing to store it means the two halves
 * agree rather than one of them cleaning up after the other for ever.
 */
import { describe, it, expect } from "vitest";
import { buildGrid } from "@/modules/comparison-table/lib/grid";
import { storedCells } from "@/modules/comparison-table/lib/table-payload";

const COLUMNS = [
    { id: "free", label: "Free", order: 0 },
    { id: "paid", label: "Paid", order: 1 },
];
const ROWS = [{ id: "storage", groupId: null, label: "Storage", order: 0 }];

describe("what a save stores", () => {
    it("stores a yes and a no, because both are claims", () => {
        const stored = storedCells([
            { rowId: "storage", columnId: "free", kind: "no" },
            { rowId: "storage", columnId: "paid", kind: "yes" },
        ]);
        expect(stored).toEqual([
            { rowId: "storage", columnId: "free", kind: "no", value: null },
            { rowId: "storage", columnId: "paid", kind: "yes", value: null },
        ]);
    });

    it("stores nothing at all for a cell nobody answered", () => {
        expect(storedCells([{ rowId: "storage", columnId: "free", kind: "unstated" }])).toEqual([]);
    });

    it("stores nothing for a value box that was opened and closed", () => {
        expect(storedCells([{ rowId: "storage", columnId: "free", kind: "value", value: "   " }])).toEqual([]);
        expect(storedCells([{ rowId: "storage", columnId: "free", kind: "value" }])).toEqual([]);
    });

    it("trims a value, because the trailing space is not part of the answer", () => {
        expect(storedCells([{ rowId: "storage", columnId: "free", kind: "value", value: "  10 GB " }]))
            .toEqual([{ rowId: "storage", columnId: "free", kind: "value", value: "10 GB" }]);
    });

    it("drops a value carried on a yes, which the reader would never show", () => {
        expect(storedCells([{ rowId: "storage", columnId: "free", kind: "yes", value: "10 GB" }]))
            .toEqual([{ rowId: "storage", columnId: "free", kind: "yes", value: null }]);
    });

    it("drops a cell with no row or no column behind it", () => {
        expect(storedCells([
            { rowId: "", columnId: "free", kind: "yes" },
            { rowId: "storage", columnId: "", kind: "yes" },
        ])).toEqual([]);
    });

    it("keeps the last word when the same intersection arrives twice", () => {
        // The table stores one cell per intersection, so two would be two
        // answers with nothing to choose between them.
        const stored = storedCells([
            { rowId: "storage", columnId: "free", kind: "yes" },
            { rowId: "storage", columnId: "free", kind: "no" },
        ]);
        expect(stored).toHaveLength(1);
        expect(stored[0].kind).toBe("no");
    });
});

describe("what the reader then sees", () => {
    it("shows a gap where the operator left one, not a cross", () => {
        const stored = storedCells([
            { rowId: "storage", columnId: "paid", kind: "yes" },
            { rowId: "storage", columnId: "free", kind: "unstated" },
        ]);
        const grid = buildGrid(COLUMNS, [], ROWS, stored);
        const cells = grid.groups[0].rows[0].cells;
        expect(cells.find((cell) => cell.columnId === "free")?.kind).toBe("unstated");
        expect(cells.find((cell) => cell.columnId === "paid")?.kind).toBe("yes");
    });

    it("shows a cross only where the operator put one", () => {
        const stored = storedCells([{ rowId: "storage", columnId: "free", kind: "no" }]);
        const grid = buildGrid(COLUMNS, [], ROWS, stored);
        expect(grid.groups[0].rows[0].cells.find((cell) => cell.columnId === "free")?.kind).toBe("no");
    });

    it("leaves a whole row unstated when nothing in it was answered", () => {
        const grid = buildGrid(COLUMNS, [], ROWS, storedCells([]));
        expect(grid.groups[0].rows[0].cells.every((cell) => cell.kind === "unstated")).toBe(true);
    });
});
