/**
 * Taking something away from a member without taking everything.
 *
 * The only ban this site had was the whole site: an account is banned and
 * cannot sign in. That is the right answer for somebody who should not be
 * here, and the wrong one for almost every case an operator actually meets -
 * a member who argues in every ticket, one who cannot stop replying to a
 * thread, one who is fine everywhere except the one place they are not.
 * Banning them outright loses a member; doing nothing loses the room.
 *
 * So a restriction has a scope, and two rules decide what a scope means.
 *
 * The whole site includes every part of it. An operator who bans somebody from
 * the site and finds them still commenting has been told a lie by their own
 * admin screen, and it is the shape somebody produces by adding a narrower
 * scope later.
 *
 * A restriction that has run out is not a restriction. The clock is why an
 * operator uses this instead of a ban, so a lapsed one that still bites is the
 * feature failing at the only thing it was for.
 *
 * The scope is a word core never interprets. `tickets` and `comments` are the
 * names of modules, and core knowing them would be core knowing which modules
 * exist; whatever is installed asks about its own word.
 */
import { describe, it, expect } from "vitest";
import { restrictedFrom, SITE_WIDE } from "@/core/lib/restrictions";

const NOW = new Date("2026-09-09T12:00:00Z");
const LATER = new Date("2026-09-20T12:00:00Z");
const EARLIER = new Date("2026-09-01T12:00:00Z");

describe("a restriction on one part of the site", () => {
    it("bites where it was written", () => {
        const only = [{ scope: "tickets", expiresAt: null }];
        expect(restrictedFrom("tickets", only, NOW)).toBe(true);
    });

    it("leaves everywhere else alone", () => {
        const only = [{ scope: "tickets", expiresAt: null }];
        expect(restrictedFrom("comments", only, NOW)).toBe(false);
        expect(restrictedFrom("forum", only, NOW)).toBe(false);
    });

    it("does not bite a member with nothing against them", () => {
        expect(restrictedFrom("tickets", [], NOW)).toBe(false);
    });
});

describe("a restriction on the whole site", () => {
    it("includes every part of it", () => {
        // The shape an operator produces by banning somebody and then adding
        // a narrower scope later: the wide one has to win on its own.
        const everywhere = [{ scope: SITE_WIDE, expiresAt: null }];
        expect(restrictedFrom("tickets", everywhere, NOW)).toBe(true);
        expect(restrictedFrom("comments", everywhere, NOW)).toBe(true);
        expect(restrictedFrom("anything-a-module-invents", everywhere, NOW)).toBe(true);
    });

    it("is asked about by its own name too", () => {
        expect(restrictedFrom(SITE_WIDE, [{ scope: SITE_WIDE, expiresAt: null }], NOW)).toBe(true);
    });

    it("does not appear from a narrower one", () => {
        // Being kept out of the tickets is not being kept off the site.
        expect(restrictedFrom(SITE_WIDE, [{ scope: "tickets", expiresAt: null }], NOW)).toBe(false);
    });
});

describe("a clock", () => {
    it("keeps a restriction that has not run out", () => {
        expect(restrictedFrom("tickets", [{ scope: "tickets", expiresAt: LATER }], NOW)).toBe(true);
    });

    it("lets go of one that has", () => {
        // The clock is why an operator reaches for this instead of a ban.
        expect(restrictedFrom("tickets", [{ scope: "tickets", expiresAt: EARLIER }], NOW)).toBe(false);
    });

    it("keeps one with no clock on it for ever", () => {
        expect(restrictedFrom("tickets", [{ scope: "tickets", expiresAt: null }], NOW)).toBe(true);
    });

    it("lets go the moment it runs out, not the day after", () => {
        expect(restrictedFrom("tickets", [{ scope: "tickets", expiresAt: NOW }], NOW)).toBe(false);
    });

    it("is not fooled by a lapsed wide one over a live narrow one", () => {
        const mixed = [
            { scope: SITE_WIDE, expiresAt: EARLIER },
            { scope: "tickets", expiresAt: LATER },
        ];
        expect(restrictedFrom("tickets", mixed, NOW)).toBe(true);
        expect(restrictedFrom("comments", mixed, NOW)).toBe(false);
    });
});

describe("a scope core has never heard of", () => {
    it("is answered without core knowing what it means", () => {
        // `tickets` and `comments` are module names. Core storing them is
        // fine; core knowing them is core knowing which modules exist.
        const odd = [{ scope: "something-installed-last-week", expiresAt: null }];
        expect(restrictedFrom("something-installed-last-week", odd, NOW)).toBe(true);
        expect(restrictedFrom("tickets", odd, NOW)).toBe(false);
    });

    it("matches whatever case it was written in", () => {
        expect(restrictedFrom("Tickets", [{ scope: "tickets", expiresAt: null }], NOW)).toBe(true);
    });
});
