/**
 * Actually running the read.
 *
 * Everything dangerous was decided elsewhere: `query.ts` refuses a name that
 * is not a name, and `errors.ts` decides what a reader may be told. What is
 * left here is the connection, and three things about it.
 *
 * It is opened per read and closed after. A pool held open against somebody
 * else's database is a connection they did not agree to keep, and this reads
 * a list every minute at most.
 *
 * The session is told it may not write. The credentials should say so too, and
 * an operator who follows the instructions gives it a read-only user - but a
 * site should not depend on somebody else's care, and a transaction that
 * cannot write is one line.
 *
 * And it gives up. An external database that hangs must not hang the page it
 * is drawn on.
 */
import { Pool } from "pg";
import { log } from "@/core/sdk/server";
import { buildListQuery, type ListSource } from "./query";
import { readerSafeError, type FailureCode } from "./errors";

/** Long enough for a slow query, short enough that a page still answers. */
const TIMEOUT_MS = 5000;

export type ReadResult =
    | { rows: Record<string, unknown>[] }
    | { failed: FailureCode; message: string };

export async function readExternalList(
    connectionString: string,
    source: ListSource,
): Promise<ReadResult> {
    const built = buildListQuery(source);
    if ("refuse" in built) {
        // A name that is not a name never reaches a connection.
        return { failed: "failed", message: "That source is not set up correctly." };
    }

    const pool = new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: TIMEOUT_MS,
        // Belt as well as braces: the credentials ought to be read-only, and
        // this makes a write impossible even when they are not.
        options: "-c default_transaction_read_only=on",
        statement_timeout: TIMEOUT_MS,
    });

    try {
        const answer = await pool.query(built.text, built.values);
        return { rows: answer.rows as Record<string, unknown>[] };
    } catch (err) {
        const safe = readerSafeError(err);
        // The driver's own sentence, only here: whoever reads this log
        // already holds the credentials it might name.
        log.error("[external-data] a read failed", {
            table: source.table,
            code: safe.code,
            error: err instanceof Error ? err.message : String(err),
        });
        return { failed: safe.code, message: safe.message };
    } finally {
        await pool.end().catch(() => {});
    }
}
