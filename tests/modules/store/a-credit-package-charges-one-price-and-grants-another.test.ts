/**
 * Selling credits in packages, with a bonus for buying more.
 *
 * Until now a buyer typed a number and paid that number times a per-credit
 * price. It works and it sells nothing: there is no reason to buy a thousand
 * rather than a hundred, and an operator has no way to say "buy this much and
 * we round it up".
 *
 * A package is two numbers that must not be confused. One is what the buyer
 * is charged, and it is the only number the gateway ever sees. The other is
 * what lands in their balance, and it is larger. Add the bonus on the wrong
 * side and either the buyer is charged for credits they were given, or the
 * shop hands out a bonus on a bonus every time somebody buys twice.
 *
 * The second thing worth pinning is that both numbers are fixed when the
 * buyer pays, not when the money arrives. A gateway settles minutes later,
 * and sometimes days later for a transfer confirmed by hand. An operator who
 * edits a package in between must not change what somebody already bought:
 * the sale was at the price on the page.
 */
import { describe, it, expect } from "vitest";
import {
    creditsGranted,
    packageSnapshot,
    buyableNow,
} from "@/modules/store/lib/credit-packages";

const pack = {
    id: "pkg-1",
    name: "Starter",
    credits: 1000,
    bonusCredits: 100,
    price: 9.99,
    isActive: true,
};

describe("what a package gives and what it costs", () => {
    it("grants the credits and the bonus together", () => {
        expect(creditsGranted(pack)).toBe(1100);
    });

    it("grants only the credits when there is no bonus", () => {
        expect(creditsGranted({ ...pack, bonusCredits: 0 })).toBe(1000);
    });

    it("never lets a bonus reach the price", () => {
        // The whole point of the split: the gateway is asked for 9.99 for a
        // package worth 1100 credits.
        const snapshot = packageSnapshot(pack);
        expect(snapshot.price).toBe(9.99);
        expect(snapshot.credits).toBe(1100);
    });

    it("treats a nonsense bonus as none, rather than as a subtraction", () => {
        // A negative bonus would sell 900 credits at the price of 1000, which
        // is a shop quietly short-changing people.
        expect(creditsGranted({ ...pack, bonusCredits: -100 })).toBe(1000);
        expect(creditsGranted({ ...pack, bonusCredits: Number.NaN })).toBe(1000);
    });

    it("gives whole credits, because a balance is a count of them", () => {
        expect(creditsGranted({ ...pack, credits: 1000, bonusCredits: 10.6 })).toBe(1010);
    });
});

describe("the snapshot that travels with the payment", () => {
    it("carries what was bought, so a later edit changes nothing", () => {
        // Settled minutes later, or days later for a transfer confirmed by
        // hand. The sale was at the price on the page.
        expect(packageSnapshot(pack)).toEqual({
            packageId: "pkg-1",
            name: "Starter",
            credits: 1100,
            price: 9.99,
        });
    });

    it("is what the buyer receives, even when the package has since changed", () => {
        const sold = packageSnapshot(pack);
        // The operator doubles the bonus afterwards. The old sale is unmoved.
        expect(sold.credits).toBe(1100);
        expect(creditsGranted({ ...pack, bonusCredits: 500 })).toBe(1500);
    });
});

describe("which packages a buyer may pick", () => {
    it("offers one that is switched on and priced", () => {
        expect(buyableNow(pack)).toBe(true);
    });

    it("does not offer one switched off", () => {
        expect(buyableNow({ ...pack, isActive: false })).toBe(false);
    });

    it("does not offer one that grants nothing", () => {
        expect(buyableNow({ ...pack, credits: 0, bonusCredits: 0 })).toBe(false);
    });

    it("does not offer one that costs nothing", () => {
        // Free credits are a grant, not a sale, and a gateway refuses a zero
        // charge anyway.
        expect(buyableNow({ ...pack, price: 0 })).toBe(false);
        expect(buyableNow({ ...pack, price: -1 })).toBe(false);
    });
});
