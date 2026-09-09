/**
 * What is actually handed over, and who decides.
 *
 * This module knows how to move credits and take a cut. It does not know what
 * a member is selling: a game item, a role, a key, a licence, something a
 * module invented last week. Whatever is installed says what it can deliver
 * and does the delivering, and a listing names one of those kinds.
 *
 * The decision worth pinning is when that is checked. A kind nobody can
 * deliver has to stop the sale before the credits move, not after: the
 * alternative is a buyer who has paid, a seller who has been paid, and nothing
 * handed over, which somebody then has to unpick by hand.
 *
 * It has to be checked again at the moment of sale rather than only when the
 * listing was written. A module gets uninstalled, and the listings it made
 * deliverable outlive it.
 */
import { describe, it, expect } from "vitest";
import { deliverableBy, deliveryRefusal } from "@/modules/marketplace/lib/delivery";

const installed = [
    { kind: "game-item", label: "An item in the game" },
    { kind: "role", label: "A rank on the site" },
];

describe("whether anything can deliver a kind", () => {
    it("says yes for a kind something claims", () => {
        expect(deliverableBy("game-item", installed)).toBe(true);
    });

    it("says no for a kind nothing claims", () => {
        // The module that offered it has been uninstalled, and its listings
        // outlived it.
        expect(deliverableBy("licence-key", installed)).toBe(false);
    });

    it("says no when nothing is installed at all", () => {
        expect(deliverableBy("game-item", [])).toBe(false);
    });

    it("says no for a listing with no kind on it", () => {
        expect(deliverableBy("", installed)).toBe(false);
    });
});

describe("when a sale is stopped for it", () => {
    it("is allowed through when the kind can be delivered", () => {
        expect(deliveryRefusal("role", installed)).toBeNull();
    });

    it("is stopped before the credits move", () => {
        // A buyer who has paid, a seller who has been paid, and nothing
        // handed over is what this refusal exists to prevent.
        expect(deliveryRefusal("licence-key", installed)).toEqual({ refuse: "cannot-deliver" });
    });

    it("is stopped when every deliverer has gone", () => {
        expect(deliveryRefusal("game-item", [])).toEqual({ refuse: "cannot-deliver" });
    });
});
