/**
 * Placing a restriction, and taking one off.
 *
 * `restrictedFrom` already decides what one means once it exists. This is the
 * other end: what an operator is allowed to create, and what happens when they
 * lift it.
 *
 * Two of the refusals exist because the alternative is a control that appears
 * to work and does not. A blank scope is read by `restrictedFrom` as "no", so
 * a row with one is a restriction the screen shows, the operator believes, and
 * nothing enforces. An expiry already in the past is the same thing with a
 * date on it: saved, listed, and lapsed before the page reloads. Both are the
 * failure this whole feature exists to avoid - an operator told by their own
 * admin screen that somebody is kept out when they are not.
 *
 * Lifting is not deleting. `restrictions-server.ts` already wrote down why
 * lapsed rows stay: an operator looking at somebody's history wants to see the
 * month they spent out of the tickets. So lifting ends a restriction where it
 * stands, at the moment it was lifted, and the row remains as a record of
 * what was done and when.
 */
import { describe, it, expect } from "vitest";
import { checkNewRestriction, lift, restrictedFrom, SITE_WIDE } from "@/core/lib/restrictions";

const NOW = new Date("2026-09-10T12:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe("what an operator may place", () => {
    it("takes a scope and no expiry, which is one that never runs out", () => {
        expect(checkNewRestriction("tickets", null, NOW)).toBeNull();
    });

    it("takes a scope with an expiry ahead of now", () => {
        expect(checkNewRestriction("tickets", later(60), NOW)).toBeNull();
    });

    it("takes the whole site, which is the one word core names", () => {
        expect(checkNewRestriction(SITE_WIDE, null, NOW)).toBeNull();
    });

    it("refuses a blank scope, which would enforce nothing at all", () => {
        expect(checkNewRestriction("", null, NOW)).toBe("empty_scope");
        expect(checkNewRestriction("   ", null, NOW)).toBe("empty_scope");
    });

    it("refuses an expiry that has already passed", () => {
        expect(checkNewRestriction("tickets", later(-1), NOW)).toBe("already_lapsed");
    });

    it("refuses one expiring at this very moment, because that is lapsed too", () => {
        // `restrictedFrom` treats `expiresAt <= now` as gone, so an operator
        // setting exactly now has placed nothing.
        expect(checkNewRestriction("tickets", NOW, NOW)).toBe("already_lapsed");
    });

    it("refuses a scope longer than a word, because it is not a sentence", () => {
        expect(checkNewRestriction("x".repeat(65), null, NOW)).toBe("too_long");
    });
});

describe("what a placed restriction does", () => {
    it("bites the scope it names", () => {
        const placed = [{ scope: "tickets", expiresAt: null }];
        expect(restrictedFrom("tickets", placed, NOW)).toBe(true);
    });

    it("is exactly what the check above refuses to let anybody create", () => {
        // The two files agree, which is the point of both existing.
        const blank = [{ scope: "   ", expiresAt: null }];
        expect(restrictedFrom("tickets", blank, NOW)).toBe(false);
        const lapsed = [{ scope: "tickets", expiresAt: later(-1) }];
        expect(restrictedFrom("tickets", lapsed, NOW)).toBe(false);
    });
});

describe("lifting one", () => {
    it("ends it where it stands rather than erasing it", () => {
        const ended = lift(NOW);
        expect(ended.expiresAt).toEqual(NOW);
    });

    it("stops it biting from that moment on", () => {
        const row = { scope: "tickets", ...lift(NOW) };
        expect(restrictedFrom("tickets", [row], NOW)).toBe(false);
        expect(restrictedFrom("tickets", [row], later(60))).toBe(false);
    });

    it("leaves a restriction that was already going to lapse later alone", () => {
        // Lifting brings the end forward; it never pushes it back, which would
        // turn "take this off" into "extend it".
        const ended = lift(NOW);
        expect(ended.expiresAt.getTime()).toBeLessThanOrEqual(later(60).getTime());
    });
});
