/**
 * What a save writes, and the cell the operator never answered.
 *
 * `grid.ts` decided that a cell with no row behind it is unstated, and that
 * unstated is not "no": three answers are different to somebody choosing what
 * to pay for, and only two of them are a claim.
 *
 * An editor is where that decision gets undone. A grid of tri-state controls
 * holds a value for every intersection whether or not anybody touched it, and
 * the obvious save writes all of them - so every blank becomes a stored "no"
 * and the table starts making claims about products on the operator's behalf.
 * The writing half has to keep the reading half's promise, which is what this
 * file is: unstated is dropped rather than stored, and the gap survives all
 * the way through.
 *
 * The value box is the same shape one layer in. One that was opened and closed
 * holds an empty string, `stated` already refuses to draw it, and refusing to
 * store it means the two halves agree rather than one cleaning up after the
 * other for ever.
 */

import type { Cell } from "./grid";

/** What the editor holds for one intersection, before it is judged. */
export interface DraftCell {
    rowId: string;
    columnId: string;
    kind: "yes" | "no" | "value" | "unstated";
    value?: string | null;
}

export function storedCells(draft: readonly DraftCell[]): Cell[] {
    // One cell per intersection, last word wins: the table holds a unique row
    // per pair, and two would be two answers with nothing to choose between.
    const byPair = new Map<string, Cell>();

    for (const cell of draft) {
        const rowId = cell.rowId.trim();
        const columnId = cell.columnId.trim();
        if (rowId === "" || columnId === "") continue;
        const pair = `${rowId} ${columnId}`;

        if (cell.kind === "unstated") {
            byPair.delete(pair);
            continue;
        }

        if (cell.kind === "value") {
            const value = (cell.value ?? "").trim();
            // Nothing typed is nothing said.
            if (value === "") {
                byPair.delete(pair);
                continue;
            }
            byPair.set(pair, { rowId, columnId, kind: "value", value });
            continue;
        }

        // A yes or a no carries no value. One arriving with a leftover from a
        // control the operator switched away from would be stored and never
        // shown, which is a difference between the table and the screen.
        byPair.set(pair, { rowId, columnId, kind: cell.kind, value: null });
    }

    return [...byPair.values()];
}
