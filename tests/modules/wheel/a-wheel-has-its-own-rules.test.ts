/**
 * A site runs wheels, not a wheel.
 *
 * There was one, and its rules lived in the module: free, once a day, for
 * everybody, with the price of an extra turn in a setting. That is a
 * reasonable shape for exactly one community. A free daily wheel and a weekly
 * one for the people who bought a rank are two wheels, so the cooldown, the
 * price and who may turn it belong to the wheel.
 *
 * Every one of those rules is asked twice - by the page, to decide whether to
 * draw the button, and by the endpoint, to decide whether to honour the
 * request. Two copies of that logic is how a disabled button and a working
 * endpoint end up in the same release, so there is one function and this is
 * what pins it.
 */
import { describe, it, expect } from "vitest";
import { cooldownHoursOf, drawPrize, nextTurnAt, refusalFor } from "@/modules/wheel/lib/wheels";

const open = {
    cooldown: "daily",
    cooldownHours: 24,
    cost: 0,
    roleIds: [] as string[],
    isActive: true,
    hasPrizes: true,
};
const turner = { signedIn: true, roleId: "member", credits: 0, lastTurn: null as Date | null };
const NOW = new Date("2026-09-08T12:00:00Z");

describe("how often a wheel may be turned", () => {
    it("reads the named cooldowns as the hours they say", () => {
        expect(cooldownHoursOf({ cooldown: "none", cooldownHours: 0 })).toBe(0);
        expect(cooldownHoursOf({ cooldown: "daily", cooldownHours: 0 })).toBe(24);
        expect(cooldownHoursOf({ cooldown: "weekly", cooldownHours: 0 })).toBe(168);
        expect(cooldownHoursOf({ cooldown: "monthly", cooldownHours: 0 })).toBe(720);
    });

    it("lets a custom one carry its own hours", () => {
        expect(cooldownHoursOf({ cooldown: "custom", cooldownHours: 6 })).toBe(6);
    });

    it("counts from the last turn, not from midnight", () => {
        // A daily wheel that resets on a calendar boundary is a wheel
        // everybody turns twice, five minutes either side of it.
        const lastTurn = new Date("2026-09-08T23:30:00Z");
        expect(nextTurnAt(open, lastTurn)).toEqual(new Date("2026-09-09T23:30:00Z"));
    });

    it("has no next turn when there is no cooldown, or no last turn", () => {
        expect(nextTurnAt({ cooldown: "none", cooldownHours: 0 }, new Date())).toBeNull();
        expect(nextTurnAt(open, null)).toBeNull();
    });
});

describe("who a wheel refuses, and why", () => {
    it("lets a signed-in member turn an open, free wheel", () => {
        expect(refusalFor(open, turner, NOW)).toBeNull();
    });

    it("refuses a visitor with no account", () => {
        expect(refusalFor(open, { ...turner, signedIn: false }, NOW)).toBe("signed_out");
    });

    it("refuses everybody when it is switched off", () => {
        // Before anything else: a wheel an operator turned off is off for the
        // person who would otherwise be allowed to turn it.
        expect(refusalFor({ ...open, isActive: false }, turner, NOW)).toBe("wheel_off");
    });

    it("refuses a rank the wheel is not for", () => {
        const vipOnly = { ...open, roleIds: ["vip"] };
        expect(refusalFor(vipOnly, turner, NOW)).toBe("wrong_role");
        expect(refusalFor(vipOnly, { ...turner, roleId: "vip" }, NOW)).toBeNull();
        expect(refusalFor(vipOnly, { ...turner, roleId: null }, NOW)).toBe("wrong_role");
    });

    it("refuses somebody who turned it inside the cooldown, and allows them after", () => {
        const anHourAgo = new Date(NOW.getTime() - 3_600_000);
        expect(refusalFor(open, { ...turner, lastTurn: anHourAgo }, NOW)).toBe("too_soon");

        const yesterday = new Date(NOW.getTime() - 25 * 3_600_000);
        expect(refusalFor(open, { ...turner, lastTurn: yesterday }, NOW)).toBeNull();
    });

    it("lets a wheel with no cooldown be turned again straight away", () => {
        const free = { ...open, cooldown: "none" };
        expect(refusalFor(free, { ...turner, lastTurn: NOW }, NOW)).toBeNull();
    });

    it("refuses somebody who cannot pay for it", () => {
        const paid = { ...open, cost: 250 };
        expect(refusalFor(paid, { ...turner, credits: 100 }, NOW)).toBe("not_enough_credits");
        expect(refusalFor(paid, { ...turner, credits: 250 }, NOW)).toBeNull();
    });

    it("refuses a wheel with nothing on it, before it asks anything else", () => {
        // The endpoint has always refused this (`wheel_no_prizes`) while the
        // page drew an enabled button over a blank disc, which is the drift
        // this function exists to prevent. It is said before "sign in" and
        // before the cooldown because it is the one refusal no reader can do
        // anything about: signing in and waiting a day both lead back here.
        const empty = { ...open, hasPrizes: false };
        expect(refusalFor(empty, turner, NOW)).toBe("no_prizes");
        expect(refusalFor(empty, { ...turner, signedIn: false }, NOW)).toBe("no_prizes");
    });

    it("says the earliest reason, so a reader is told the one they can act on", () => {
        // Signed out and too soon and broke: "sign in" is the only one that
        // means anything to them.
        expect(refusalFor({ ...open, cost: 999 }, { ...turner, signedIn: false, lastTurn: NOW }, NOW))
            .toBe("signed_out");
    });
});

describe("what a turn lands on", () => {
    const prizes = [
        { id: "a", probability: 70 },
        { id: "b", probability: 30 },
    ];

    it("follows the weights", () => {
        expect(drawPrize(prizes, () => 0)?.id).toBe("a");
        expect(drawPrize(prizes, () => 69_999)?.id).toBe("a");
        expect(drawPrize(prizes, () => 70_001)?.id).toBe("b");
    });

    it("never lands on a prize an operator switched off", () => {
        const off = [{ id: "a", probability: 0 }, { id: "b", probability: 10 }];
        for (const roll of [0, 1, 5_000, 9_999]) {
            expect(drawPrize(off, () => roll)?.id).toBe("b");
        }
    });

    it("says there is nothing to draw rather than dividing by zero", () => {
        // Every prize at zero odds is a wheel with nothing on it, which the
        // caller has to be able to tell from a wheel with no prizes. It used
        // to reach `randomInt(0, 0)`, which throws: every turn answered 500.
        expect(drawPrize([{ id: "a", probability: 0 }], () => 0)).toBeNull();
        expect(drawPrize([], () => 0)).toBeNull();
    });
});
