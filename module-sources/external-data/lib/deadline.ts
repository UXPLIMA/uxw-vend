/**
 * Giving up on somebody else's database.
 *
 * The promise `read.ts` makes is that an external database which hangs must
 * not hang the page it is drawn on, and it used to keep that promise by asking
 * each server to stop itself: `statement_timeout` in the Postgres connection
 * options and a session variable in MySQL.
 *
 * The MySQL half was wrong, and only a real server said so. `MAX_EXECUTION_TIME`
 * is MySQL's; MariaDB speaks the same protocol, uses the same driver, is routed
 * to it deliberately, and has never heard of that variable - so every read
 * failed with "Unknown system variable" while every refusal behaved perfectly.
 *
 * Trying one and falling back to the other would rest the promise on a list of
 * server variables that has to stay right for ever. The deadline lives on this
 * side of the socket instead: one mechanism for both, and it covers what a
 * server variable never did - a connection that never opens, and a network
 * that stops answering halfway through the rows.
 *
 * The word "timeout" is in the message on purpose. `errors.ts` reads the
 * sentence to decide what an operator is told, and a deadline that gave up in
 * its own words would be reported as "could not be read".
 */

export async function withDeadline<T>(
    work: Promise<T>,
    ms: number,
    /** Closes the connection when the deadline wins, so nothing is left open. */
    abandon?: () => void,
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            abandon?.();
            reject(new Error("Read timeout: the other database did not answer in time"));
        }, ms);
    });

    try {
        return await Promise.race([work, deadline]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}
