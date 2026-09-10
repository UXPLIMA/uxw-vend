/**
 * Actually running the read.
 *
 * Everything dangerous was decided elsewhere: `query.ts` refuses a name that
 * is not a name, `dialect.ts` says which database a connection string names,
 * and `errors.ts` decides what a reader may be told. What is left here is the
 * connection, and four things about it.
 *
 * It is opened per read and closed after. A pool held open against somebody
 * else's database is a connection they did not agree to keep, and this reads
 * a list every minute at most.
 *
 * The session is told it may not write. The credentials should say so too, and
 * an operator who follows the instructions gives it a read-only user - but a
 * site should not depend on somebody else's care, and a transaction that
 * cannot write is one line in either dialect.
 *
 * It gives up, on this side of the socket. Each driver has its own way of
 * asking a server to stop itself and they do not agree - MySQL's session
 * variable is one MariaDB has never heard of, which made every read against
 * MariaDB fail while every refusal behaved. `deadline.ts` is one mechanism for
 * both, and it covers what a server variable never did.
 *
 * And the driver is loaded only when a connection actually names it. Both are
 * a few megabytes of parser and socket handling, and the great majority of
 * sites configure neither: a static import would put both into every server
 * process to serve the installs that use one.
 */
import { log } from "@/core/sdk/server";
import { buildListQuery, type ListSource } from "./query";
import { withDeadline } from "./deadline";
import { dialectOf, type Dialect } from "./dialect";
import { readerSafeError, type FailureCode } from "./errors";

/** Long enough for a slow query, short enough that a page still answers. */
const TIMEOUT_MS = 5000;

export type ReadResult =
    | { rows: Record<string, unknown>[] }
    | { failed: FailureCode; message: string };

type Rows = Record<string, unknown>[];

async function readFromPostgres(connectionString: string, text: string, values: number[]): Promise<Rows> {
    const { Pool } = await import("pg");
    const pool = new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: TIMEOUT_MS,
        // Belt as well as braces: the credentials ought to be read-only, and
        // this makes a write impossible even when they are not.
        options: "-c default_transaction_read_only=on",
        // This one is real here, and it is still not the guarantee: the
        // deadline above the call is.
        statement_timeout: TIMEOUT_MS,
    });
    try {
        const answer = await withDeadline(pool.query(text, values), TIMEOUT_MS, () => {
            void pool.end().catch(() => {});
        });
        return answer.rows as Rows;
    } finally {
        await pool.end().catch(() => {});
    }
}

async function readFromMysql(connectionString: string, text: string, values: number[]): Promise<Rows> {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection({
        uri: connectionString,
        connectTimeout: TIMEOUT_MS,
        // Off by default in this driver, and named anyway: the whole of
        // `query.ts` exists because one statement must stay one statement.
        multipleStatements: false,
    });
    try {
        // The read-only promise, which both servers understand. There is no
        // statement timeout here that both also understand, which is why the
        // deadline is on this side.
        await connection.query("SET SESSION TRANSACTION READ ONLY");
        const [rows] = await withDeadline(connection.query(text, values), TIMEOUT_MS, () => {
            void connection.destroy();
        });
        return Array.isArray(rows) ? (rows as Rows) : [];
    } finally {
        await connection.end().catch(() => {});
    }
}

const READERS: Record<Dialect, (connectionString: string, text: string, values: number[]) => Promise<Rows>> = {
    postgres: readFromPostgres,
    mysql: readFromMysql,
};

export async function readExternalList(
    connectionString: string,
    source: ListSource,
): Promise<ReadResult> {
    /*
     * Which database this is, before anything is built. A string naming a
     * scheme nothing here reads is refused rather than defaulted: opening a
     * Postgres socket to whatever host a `mongodb://` string names would be a
     * connection nobody asked for, made with somebody's credentials.
     */
    const dialect = dialectOf(connectionString);
    if (!dialect) {
        return { failed: "failed", message: "That connection is not one this can read." };
    }

    const built = buildListQuery(source, dialect);
    if ("refuse" in built) {
        // A name that is not a name never reaches a connection.
        return { failed: "failed", message: "That source is not set up correctly." };
    }

    try {
        return { rows: await READERS[dialect](connectionString, built.text, built.values) };
    } catch (err) {
        const safe = readerSafeError(err);
        // The driver's own sentence, only here: whoever reads this log
        // already holds the credentials it might name.
        log.error("[external-data] a read failed", {
            table: source.table,
            dialect,
            code: safe.code,
            error: err instanceof Error ? err.message : String(err),
        });
        return { failed: safe.code, message: safe.message };
    }
}
