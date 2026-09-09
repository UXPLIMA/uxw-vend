/**
 * A table for choosing between things, and the cell nobody filled in.
 *
 * The one decision here is that a cell an operator has not filled in is
 * unstated, and unstated is not "no". Three answers are different to a reader
 * - yes, no, and no comment - and only two of them are a claim. Drawing a
 * cross for the third tells somebody deciding what to pay for that a thing
 * lacks a feature nobody ever said either way.
 *
 * Everything else is order, and one rule inside it: a row whose group has gone
 * is kept rather than dropped. A comparison that silently loses a feature is
 * worse than one that shows it in the wrong place.
 */

export interface Column {
    id: string;
    label: string;
    order: number;
}

export interface Group {
    id: string;
    label: string;
    order: number;
}

export interface Row {
    id: string;
    /** Null for a row the operator did not put in a group. */
    groupId: string | null;
    label: string;
    order: number;
}

export type CellKind = "yes" | "no" | "value" | "unstated";

export interface Cell {
    rowId: string;
    columnId: string;
    kind: Exclude<CellKind, "unstated">;
    value: string | null;
}

export interface GridCell {
    columnId: string;
    kind: CellKind;
    value: string | null;
}

export interface GridRow {
    id: string;
    label: string;
    cells: GridCell[];
}

export interface GridGroup {
    /** Null for the run of rows that belong to no group. */
    id: string | null;
    label: string | null;
    rows: GridRow[];
}

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

/** What a stated cell becomes, or nothing when it says nothing. */
function stated(cell: Cell | undefined, columnId: string): GridCell {
    if (!cell) return { columnId, kind: "unstated", value: null };
    if (cell.kind === "value") {
        const value = (cell.value ?? "").trim();
        // A value box somebody opened and closed is not an answer.
        if (value === "") return { columnId, kind: "unstated", value: null };
        return { columnId, kind: "value", value };
    }
    return { columnId, kind: cell.kind, value: null };
}

/** The table, ready to draw: groups in order, each row one cell per column. */
export function buildGrid(
    columns: Column[],
    groups: Group[],
    rows: Row[],
    cells: Cell[],
): { columns: Column[]; groups: GridGroup[] } {
    const orderedColumns = [...columns].sort(byOrder);
    const known = new Set(orderedColumns.map((column) => column.id));

    const byRow = new Map<string, Map<string, Cell>>();
    for (const cell of cells) {
        // A cell pointing at a column that has gone is not an answer to
        // anything on this table.
        if (!known.has(cell.columnId)) continue;
        const forRow = byRow.get(cell.rowId) ?? new Map<string, Cell>();
        forRow.set(cell.columnId, cell);
        byRow.set(cell.rowId, forRow);
    }

    const draw = (row: Row): GridRow => ({
        id: row.id,
        label: row.label,
        cells: orderedColumns.map((column) => stated(byRow.get(row.id)?.get(column.id), column.id)),
    });

    const grouped: GridGroup[] = [];
    for (const group of [...groups].sort(byOrder)) {
        const inside = rows.filter((row) => row.groupId === group.id).sort(byOrder);
        // A group with nothing in it is a heading over a gap.
        if (inside.length === 0) continue;
        grouped.push({ id: group.id, label: group.label, rows: inside.map(draw) });
    }

    // Everything else, last: rows with no group, and rows whose group was
    // deleted out from under them. Dropping those would quietly remove a
    // feature from a comparison somebody is reading to make a decision.
    const placed = new Set(groups.map((group) => group.id));
    const loose = rows
        .filter((row) => row.groupId === null || !placed.has(row.groupId))
        .sort(byOrder);
    if (loose.length > 0) {
        grouped.push({ id: null, label: null, rows: loose.map(draw) });
    }

    return { columns: orderedColumns, groups: grouped };
}
