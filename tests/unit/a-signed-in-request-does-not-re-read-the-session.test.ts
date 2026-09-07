/**
 * The freshness stamp has to live somewhere that survives the request.
 *
 * The `jwt` callback re-reads the database when `token.checkedAt` is older
 * than the recheck interval, and it stamps the token afterwards. The stamp
 * only means something if the token is written back to the browser, and it is
 * not: this app calls `auth()` directly from route handlers and from the
 * proxy, and Auth.js re-issues the session cookie from its own handlers only.
 *
 * Measured against the running server, one signed-in `GET /api/v1/users/me`,
 * the client holding its cookie the way a browser does. Inside the interval
 * the request costs four statements, all of them the route's own work. The
 * first request past it costs nine, and the four extra are the recheck:
 *
 *     SELECT User    isBanned, isDeleted, roleId
 *     SELECT Role    name, priority
 *     SELECT UserSession   isRevoked
 *     UPDATE UserSession   lastActiveAt
 *
 * and no `Set-Cookie` on the response, so the stamp the callback just wrote
 * never leaves the process. Every following request paid those four again,
 * for the life of the cookie. So the interval bounded nothing: the same shape
 * as the `updateAge` bug this project already fixed once, a mechanism that
 * reads correctly and is never actually consulted.
 *
 * A stamp the process keeps is a stamp that survives, and the staleness it
 * allows is the one already agreed: each worker re-reads a token at most once
 * per interval. A worker that has never seen the token checks it, which is
 * what a fresh deployment or a new instance should do anyway.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
    markChecked,
    wasCheckedWithin,
    forgetChecked,
    sweepCheckedSessions,
    clearCheckedSessions,
} from "@/core/lib/session-check-memo";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

beforeEach(() => {
    clearCheckedSessions();
});

describe("what the process remembers about a token", () => {
    it("knows nothing about a token it has never seen", () => {
        expect(wasCheckedWithin("t1", MINUTE, NOW)).toBe(false);
    });

    it("remembers a check for as long as the interval", () => {
        markChecked("t1", NOW);
        expect(wasCheckedWithin("t1", MINUTE, NOW)).toBe(true);
        expect(wasCheckedWithin("t1", MINUTE, NOW + MINUTE - 1)).toBe(true);
    });

    it("forgets once the interval has passed, so a ban still lands", () => {
        markChecked("t1", NOW);
        expect(wasCheckedWithin("t1", MINUTE, NOW + MINUTE)).toBe(false);
        expect(wasCheckedWithin("t1", MINUTE, NOW + 10 * MINUTE)).toBe(false);
    });

    it("keeps one token's answer out of another's", () => {
        markChecked("t1", NOW);
        expect(wasCheckedWithin("t2", MINUTE, NOW)).toBe(false);
    });

    it("does not trust a stamp from the future, which is a clock that moved", () => {
        markChecked("t1", NOW + MINUTE);
        expect(wasCheckedWithin("t1", MINUTE, NOW)).toBe(false);
    });

    it("can be told to forget, which is what an impersonation swap needs", () => {
        // Stepping into another account rewrites who the token is for, so the
        // next request has to look, whatever this process remembers.
        markChecked("t1", NOW);
        forgetChecked("t1");
        expect(wasCheckedWithin("t1", MINUTE, NOW)).toBe(false);
    });

    it("survives being told to forget a token it does not hold", () => {
        expect(() => forgetChecked("never-seen")).not.toThrow();
    });
});

describe("the size of what it remembers", () => {
    it("drops what it no longer needs, so a busy site does not grow a map for ever", () => {
        for (let i = 0; i < 100; i++) markChecked(`old-${i}`, NOW);
        markChecked("recent", NOW + 5 * MINUTE);

        const dropped = sweepCheckedSessions(MINUTE, NOW + 5 * MINUTE);

        expect(dropped).toBe(100);
        expect(wasCheckedWithin("recent", MINUTE, NOW + 5 * MINUTE)).toBe(true);
    });

    it("keeps an entry that is still inside the window", () => {
        markChecked("t1", NOW);
        expect(sweepCheckedSessions(MINUTE, NOW + MINUTE / 2)).toBe(0);
        expect(wasCheckedWithin("t1", MINUTE, NOW + MINUTE / 2)).toBe(true);
    });
});
