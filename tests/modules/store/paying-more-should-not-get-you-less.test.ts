/**
 * What a credit costs, once the bonus is counted.
 *
 * A package is three numbers an operator types separately - credits, bonus and
 * price - and the number that matters is none of them. The bonus never reaches
 * the charge, so a buyer paying for a 1000-credit package with 200 on top gets
 * 1200 for the price of 1000, and the only way to compare two packages is to
 * work that out for both.
 *
 * Nobody does. The mistake a ladder of packages produces, over and over, is a
 * bigger one that is worse value than a smaller one: somebody raises the bonus
 * on the middle tier, or rounds a price up, and the top package quietly
 * becomes the wrong thing to buy. The buyer who notices feels cheated and the
 * one who does not is overcharged, and the operator finds out from neither.
 *
 * So the screen works it out and says so before the save. Only against
 * packages that are actually on sale, because a retired one is not an offer,
 * and only against cheaper ones, because paying less for less is the ladder
 * working.
 */
import { describe, it, expect } from "vitest";
import { creditsPerUnit, poorValue } from "@/modules/store/lib/credit-package-value";

const pack = (id: string, credits: number, bonusCredits: number, price: number, isActive = true) =>
    ({ id, credits, bonusCredits, price, isActive });

describe("what a credit costs", () => {
    it("counts the bonus, because the buyer receives it", () => {
        expect(creditsPerUnit(pack("a", 1000, 200, 10))).toBe(120);
    });

    it("is the plain division when there is no bonus", () => {
        expect(creditsPerUnit(pack("a", 500, 0, 5))).toBe(100);
    });

    it("says nothing rather than dividing by nothing", () => {
        expect(creditsPerUnit(pack("a", 500, 0, 0))).toBeNull();
        expect(creditsPerUnit(pack("a", 500, 0, Number.NaN))).toBeNull();
    });

    it("reads a price that arrived as a string, which a decimal column does", () => {
        expect(creditsPerUnit({ ...pack("a", 1000, 0, 0), price: "10" as unknown as number })).toBe(100);
    });
});

describe("a ladder where paying more gets you less", () => {
    it("says nothing when each step is better value than the last", () => {
        expect(poorValue([
            pack("small", 100, 0, 1),
            pack("middle", 1000, 100, 9),
            pack("large", 5000, 1000, 40),
        ])).toEqual([]);
    });

    it("names the package a cheaper one beats", () => {
        const flagged = poorValue([
            pack("small", 1000, 500, 5),
            pack("large", 2000, 0, 20),
        ]);
        expect(flagged).toEqual(["large"]);
    });

    it("says nothing when the two are the same value, because that is a choice", () => {
        expect(poorValue([
            pack("small", 100, 0, 1),
            pack("large", 1000, 0, 10),
        ])).toEqual([]);
    });

    it("ignores a package that is not on sale, because it is not an offer", () => {
        expect(poorValue([
            pack("retired", 1000, 900, 1, false),
            pack("live", 1000, 0, 10),
        ])).toEqual([]);
    });

    it("does not flag a package for being beaten by a dearer one", () => {
        // Paying less for less is the ladder working, not a mistake.
        expect(poorValue([
            pack("small", 100, 0, 5),
            pack("large", 10000, 0, 10),
        ])).toEqual([]);
    });

    it("skips a package whose price says nothing", () => {
        expect(poorValue([pack("free", 100, 0, 0), pack("live", 100, 0, 10)])).toEqual([]);
    });

    it("flags every package a cheaper one beats, not just the first", () => {
        const flagged = poorValue([
            pack("bargain", 5000, 0, 5),
            pack("bad1", 100, 0, 6),
            pack("bad2", 200, 0, 7),
        ]);
        expect(flagged.sort()).toEqual(["bad1", "bad2"]);
    });
});
