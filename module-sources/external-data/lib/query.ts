/**
 * Building a read against somebody else's database.
 *
 * An operator points this at a database they already have, picks a table and
 * some columns, and gets a list on their site. Which means names they typed
 * end up inside a query, and an identifier is the one thing SQL will not let
 * you bind: a placeholder carries a value, never a table or a column. Whatever
 * goes there is concatenated, and concatenation is how a feature like this
 * becomes the worst vulnerability on a site.
 *
 * "Only an admin can set it" is not the answer. An admin session is one stolen
 * cookie, and a setting written once is read on every page load for ever
 * after. The name has to be safe on its own.
 *
 * So a name is refused unless it is a name, rather than escaped into one.
 * Escaping is a thing you can get subtly wrong; refusing is not. What is
 * accepted is quoted anyway, so a column called `order` still works.
 */

/** Letters, digits and underscores, starting with a letter. Nothing else. */
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Postgres will not take an identifier longer than this, and nor will we. */
const MAX_NAME = 63;

/** The most rows this will ever ask for, however it is configured. */
const MAX_ROWS = 1000;

/**
 * The name, quoted and safe to concatenate, or null when it is not a name.
 *
 * The pattern is ASCII on purpose. A name that is only unicode which looks
 * like letters is not something somebody types by hand.
 */
export function safeIdentifier(name: string): string | null {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_NAME) return null;
    if (!NAME.test(trimmed)) return null;
    return `"${trimmed}"`;
}

export interface ListSource {
    table: string;
    columns: string[];
    /** Empty to leave the order to the database. */
    orderBy: string;
    descending: boolean;
    limit: number;
}

export type BuiltQuery =
    | { text: string; values: number[] }
    | { refuse: "bad-identifier" | "no-columns" };

/** The read, or a refusal. Never a query with an unchecked name in it. */
export function buildListQuery(source: ListSource): BuiltQuery {
    if (source.columns.length === 0) return { refuse: "no-columns" };

    const table = safeIdentifier(source.table);
    if (!table) return { refuse: "bad-identifier" };

    const columns: string[] = [];
    for (const column of source.columns) {
        const safe = safeIdentifier(column);
        if (!safe) return { refuse: "bad-identifier" };
        columns.push(safe);
    }

    // Named columns only. `SELECT *` hands back whatever that table happens to
    // hold, which on somebody else's database is password hashes and email
    // addresses nobody asked to publish.
    let text = `SELECT ${columns.join(", ")} FROM ${table}`;

    if (source.orderBy.trim() !== "") {
        const order = safeIdentifier(source.orderBy);
        if (!order) return { refuse: "bad-identifier" };
        text += ` ORDER BY ${order} ${source.descending ? "DESC" : "ASC"}`;
    }

    // The one part that can be bound, so it is. Bounded as well, because an
    // external table can hold millions of rows and nobody meant to draw them.
    const limit = Number.isFinite(source.limit)
        ? Math.min(MAX_ROWS, Math.max(1, Math.floor(source.limit)))
        : 1;

    return { text: `${text} LIMIT $1`, values: [limit] };
}
