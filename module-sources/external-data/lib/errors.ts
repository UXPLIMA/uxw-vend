/**
 * What a reader is told when somebody else's database will not answer.
 *
 * A driver error is written for whoever holds the credentials. It names the
 * host, the port, the user and the database, and when a connection string
 * fails to parse it contains the password in full. Handing that to a page is
 * how a connection string ends up in a screenshot in a support thread.
 *
 * An operator does need to know what went wrong, and "something failed" wastes
 * their afternoon. So the kind of failure is named and the details are not.
 * The driver's own sentence goes to the log, where whoever reads it already
 * has the credentials.
 *
 * Nothing here is built from the error's text. The answers are written out,
 * which is the only way to be sure none of them carries a fragment of it.
 *
 * Two drivers write these sentences and they do not agree on the words. A
 * missing table is "does not exist" in one and "doesn't exist" in the other; a
 * query stopped by the clock is "canceling statement" in one and "execution
 * time exceeded" in the other. A sentence nothing here recognises falls to
 * "could not be read", which is the answer that wastes an operator's
 * afternoon - so both sets of words are listed rather than one.
 */

export type FailureCode = "unreachable" | "refused" | "no-such-table" | "timeout" | "failed";

const SAID: Record<FailureCode, string> = {
    unreachable: "The other database did not answer.",
    refused: "The other database refused the sign-in.",
    "no-such-table": "That table or column is not in the other database.",
    timeout: "The other database took too long to answer.",
    failed: "The other database could not be read.",
};

/** Which kind of failure this is, and a sentence that carries none of it. */
export function readerSafeError(err: unknown): { code: FailureCode; message: string } {
    const raw = err instanceof Error ? err.message : "";
    const code = classify(raw);
    return { code, message: SAID[code] };
}

function classify(raw: string): FailureCode {
    const text = raw.toLowerCase();
    if (text.includes("econnrefused") || text.includes("enotfound") || text.includes("ehostunreach")) {
        return "unreachable";
    }
    if (text.includes("authentication failed") || text.includes("password") || text.includes("permission denied")) {
        return "refused";
    }
    if (
        text.includes("does not exist")
        || text.includes("doesn't exist")
        || text.includes("unknown column")
        || text.includes("undefined table")
        || text.includes("unknown table")
    ) {
        return "no-such-table";
    }
    if (
        text.includes("timeout")
        || text.includes("etimedout")
        || text.includes("canceling statement")
        || text.includes("execution time exceeded")
        || text.includes("query execution was interrupted")
    ) {
        return "timeout";
    }
    return "failed";
}
