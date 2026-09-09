/**
 * Which help articles are failing the people who read them.
 *
 * The panel counted votes and stopped there: "40 / 3" in one column, with the
 * operator left to divide two hundred rows in their head. The number that
 * answers the question is the share of readers a page helped.
 *
 * A plain share is worse than no number, though, because it sorts by luck. One
 * reader clicking yes is 100%, and it would sit above an article two hundred
 * people voted on at 96%; one reader clicking no is 0% and would head a list
 * of things to rewrite. So the ranking uses the low end of what the votes can
 * support - the share a cautious reader would still believe - which starts
 * near zero and climbs towards the plain share as the votes come in.
 *
 * The verdict is separate from the score, and deliberately refuses to give one
 * until enough people have voted. "Nobody knows yet" is a true answer and it
 * is the one an article with two votes deserves.
 */
import { describe, it, expect } from "vitest";
import { MIN_VOTES_FOR_A_VERDICT, helpfulness } from "@/modules/help-center/lib/helpfulness";

describe("what the votes on one article say", () => {
    it("counts both sides", () => {
        expect(helpfulness(30, 10).votes).toBe(40);
    });

    it("gives the plain share, for the operator to read", () => {
        expect(helpfulness(30, 10).ratio).toBeCloseTo(0.75, 5);
    });

    it("has no share at all when nobody has voted", () => {
        const none = helpfulness(0, 0);
        expect(none.ratio).toBeNull();
        expect(none.verdict).toBe("unrated");
    });

    it("puts an article nobody voted on in the middle, out of both ends of the sort", () => {
        // Neither the best nor the worst. A zero would head the list of things
        // to rewrite with an article nobody has read.
        expect(helpfulness(0, 0).score).toBe(0.5);
    });

    it("treats a negative or broken count as no vote", () => {
        expect(helpfulness(-5, 0).votes).toBe(0);
        expect(helpfulness(Number.NaN, 3).votes).toBe(3);
    });
});

describe("the score a list is ordered by", () => {
    it("does not put one yes above two hundred", () => {
        const lucky = helpfulness(1, 0);
        const proven = helpfulness(192, 8);
        expect(lucky.ratio).toBe(1);
        expect(proven.ratio).toBeLessThan(1);
        expect(proven.score).toBeGreaterThan(lucky.score);
    });

    it("does not put one no below two hundred", () => {
        const unlucky = helpfulness(0, 1);
        const failing = helpfulness(8, 192);
        expect(unlucky.score).toBeGreaterThan(failing.score);
    });

    it("closes on the plain share as the votes come in", () => {
        const few = helpfulness(9, 1);
        const many = helpfulness(900, 100);
        expect(few.score).toBeLessThan(many.score);
        expect(many.score).toBeLessThan(many.ratio as number);
        expect(many.score).toBeGreaterThan(0.85);
    });

    it("stays inside nought and one", () => {
        for (const [yes, no] of [[0, 0], [1, 0], [0, 1], [5000, 0], [0, 5000]]) {
            const read = helpfulness(yes, no);
            expect(read.score).toBeGreaterThanOrEqual(0);
            expect(read.score).toBeLessThanOrEqual(1);
        }
    });
});

describe("the verdict an operator reads", () => {
    it("withholds one until enough people have voted", () => {
        expect(helpfulness(MIN_VOTES_FOR_A_VERDICT - 1, 0).verdict).toBe("unrated");
        expect(helpfulness(MIN_VOTES_FOR_A_VERDICT, 0).verdict).not.toBe("unrated");
    });

    it("says an article is helping when most readers say so", () => {
        expect(helpfulness(48, 2).verdict).toBe("helping");
    });

    it("says an article is failing when most readers say it did not help", () => {
        expect(helpfulness(5, 45).verdict).toBe("failing");
    });

    it("says nothing stronger than mixed when the votes are split", () => {
        expect(helpfulness(25, 25).verdict).toBe("mixed");
    });
});
