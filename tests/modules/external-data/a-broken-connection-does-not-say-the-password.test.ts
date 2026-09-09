/**
 * What a reader is told when somebody else's database will not answer.
 *
 * A driver error is written for whoever is holding the credentials. It names
 * the host, the port, the user, the database, and in the common case of a URL
 * that failed to parse it contains the password in full. Handing that to a
 * page is how a connection string ends up in a screenshot in a support
 * thread.
 *
 * An operator does need to know what went wrong, and "something failed" wastes
 * their afternoon. So the two audiences are separated: the kind of failure is
 * named, the details are not, and the raw text goes to the log where the
 * person reading it already has the credentials anyway.
 */
import { describe, it, expect } from "vitest";
import { readerSafeError } from "@/modules/external-data/lib/errors";

describe("what comes back when the other database will not answer", () => {
    it("names a refused connection without naming the host", () => {
        const err = new Error("connect ECONNREFUSED 10.0.0.5:5432");
        const said = readerSafeError(err);
        expect(said.code).toBe("unreachable");
        expect(said.message).not.toContain("10.0.0.5");
        expect(said.message).not.toContain("5432");
    });

    it("names a refused sign-in without naming the user", () => {
        const err = new Error('password authentication failed for user "gameserver"');
        const said = readerSafeError(err);
        expect(said.code).toBe("refused");
        expect(said.message).not.toContain("gameserver");
    });

    it("never repeats a connection string, whatever the error carried", () => {
        const err = new Error("invalid connection string: postgres://admin:hunter2@db.internal:5432/game");
        const said = readerSafeError(err);
        expect(said.message).not.toContain("hunter2");
        expect(said.message).not.toContain("db.internal");
        expect(said.message).not.toContain("postgres://");
    });

    it("says a table or column is missing, because that is the operator's own typo", () => {
        // The one detail worth passing on: they typed it, and it is not a
        // secret. Even so, only the kind of thing, not the driver's sentence.
        const err = new Error('relation "playerz" does not exist');
        expect(readerSafeError(err).code).toBe("no-such-table");
    });

    it("says a read took too long", () => {
        const err = new Error("Query read timeout");
        expect(readerSafeError(err).code).toBe("timeout");
    });

    it("falls back to saying nothing useful rather than guessing", () => {
        const err = new Error("something nobody has seen before at /srv/app/lib/db.js:44");
        const said = readerSafeError(err);
        expect(said.code).toBe("failed");
        expect(said.message).not.toContain("/srv/app");
    });

    it("copes with something that is not an error at all", () => {
        expect(readerSafeError("a string").code).toBe("failed");
        expect(readerSafeError(null).code).toBe("failed");
        expect(readerSafeError(undefined).code).toBe("failed");
    });
});
