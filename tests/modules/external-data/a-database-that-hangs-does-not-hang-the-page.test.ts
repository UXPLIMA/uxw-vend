/**
 * Giving up on somebody else's database.
 *
 * `read.ts` promises that an external database which hangs must not hang the
 * page it is drawn on, and it kept that promise by asking each server to stop
 * itself: `statement_timeout` in the Postgres connection options, and a
 * session variable in MySQL.
 *
 * The MySQL half was wrong, and only a real server said so. `MAX_EXECUTION_TIME`
 * is MySQL's variable; MariaDB, which speaks the same protocol and uses the
 * same driver and which `dialect.ts` deliberately routes to it, has never
 * heard of it and answers "Unknown system variable". Every read failed - the
 * refusals all behaved, the injection was still refused, and the one thing the
 * feature is for did not work.
 *
 * Trying one and falling back to the other would leave the promise resting on
 * a list of server variables that has to stay right for ever. So the deadline
 * moved to this side of the socket, where it is one mechanism for both and
 * covers the parts a server variable never did: a connection that never opens
 * and a network that stops answering mid-row.
 */
import { describe, it, expect } from "vitest";
import { withDeadline } from "@/modules/external-data/lib/deadline";

const never = () => new Promise<string>(() => {});
const soon = (value: string, ms: number) => new Promise<string>((resolve) => setTimeout(() => resolve(value), ms));

describe("a read that answers in time", () => {
    it("gives back what it read", async () => {
        await expect(withDeadline(soon("rows", 5), 200)).resolves.toBe("rows");
    });

    it("passes a failure through as the failure it was", async () => {
        const boom = new Error("ER_NO_SUCH_TABLE");
        await expect(withDeadline(Promise.reject(boom), 200)).rejects.toBe(boom);
    });
});

describe("a read that does not", () => {
    it("gives up rather than waiting for ever", async () => {
        await expect(withDeadline(never(), 20)).rejects.toThrow(/timeout/i);
    });

    it("says so in words the classifier already knows", async () => {
        // `errors.ts` reads the sentence to decide what an operator is told,
        // so a deadline that gave up in its own words would be reported as
        // "could not be read" rather than as the timeout it is.
        const { readerSafeError } = await import("@/modules/external-data/lib/errors");
        const err = await withDeadline(never(), 20).catch((e: unknown) => e);
        expect(readerSafeError(err).code).toBe("timeout");
    });

    it("does not leave the connection open behind it", async () => {
        let closed = false;
        await withDeadline(never(), 20, () => { closed = true; }).catch(() => {});
        expect(closed).toBe(true);
    });

    it("does not close a connection that answered in time", async () => {
        let closed = false;
        await withDeadline(soon("rows", 5), 200, () => { closed = true; });
        expect(closed).toBe(false);
    });
});
