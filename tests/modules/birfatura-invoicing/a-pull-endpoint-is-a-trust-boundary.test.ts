/**
 * The endpoint that hands over every customer's name, address and tax number.
 *
 * A pulling integrator signs in with one shared secret in a header, and that
 * secret is the only thing between the open internet and the billing details
 * of everybody who has ever bought anything here. There is no session, no
 * rate limit worth the name, and no second factor: it is one string compared
 * against another.
 *
 * Two ways of getting that comparison wrong are common enough to be worth
 * pinning:
 *
 * - a shop that has not set the secret yet. "No secret configured" must mean
 *   nobody gets in. Read the other way - no secret, no check - a fresh
 *   install publishes its whole customer list;
 * - comparing with `===`. It stops at the first byte that differs, so the
 *   time it takes says how much of the secret was right, and a secret can be
 *   recovered a byte at a time. The comparison has to take the same time
 *   whatever it is given.
 */
import { describe, it, expect } from "vitest";
import { tokenAccepted } from "@/modules/birfatura-invoicing/lib/token";

const SECRET = "5f2b7c1e-9a44-4c8d-b0e1-7d6a3f905c22";

describe("a request carrying the right secret", () => {
    it("is let in", () => {
        expect(tokenAccepted(SECRET, SECRET)).toBe(true);
    });

    it("is let in whichever way the header was spelled, since the value is what matters", () => {
        expect(tokenAccepted(` ${SECRET} `, SECRET)).toBe(true);
    });
});

describe("a request carrying the wrong secret", () => {
    it("is turned away", () => {
        expect(tokenAccepted("not-the-secret", SECRET)).toBe(false);
    });

    it("is turned away when it is a prefix of the right one", () => {
        // The shape a byte-at-a-time attack sends.
        expect(tokenAccepted(SECRET.slice(0, 10), SECRET)).toBe(false);
    });

    it("is turned away when it is longer", () => {
        expect(tokenAccepted(SECRET + "x", SECRET)).toBe(false);
    });

    it("is turned away when it brought none at all", () => {
        expect(tokenAccepted(null, SECRET)).toBe(false);
        expect(tokenAccepted(undefined, SECRET)).toBe(false);
        expect(tokenAccepted("", SECRET)).toBe(false);
        expect(tokenAccepted("   ", SECRET)).toBe(false);
    });
});

describe("a shop that has not set a secret yet", () => {
    it("lets nobody in, whatever they send", () => {
        // The expensive direction. Read as "no secret, no check", a fresh
        // install publishes every customer's address and tax number.
        expect(tokenAccepted("anything", "")).toBe(false);
        expect(tokenAccepted("", "")).toBe(false);
        expect(tokenAccepted("anything", "   ")).toBe(false);
    });
});
