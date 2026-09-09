/**
 * What a purchase remembers between paying for it and claiming it.
 *
 * Checkout asks a buyer for the name to deliver to, separately from the name
 * they signed in with, because the two are different on every site that
 * delivers to a game. It fills in the fields the product asks for at the same
 * time - a server, a colour, a size - and hands both to delivery.
 *
 * A purchase that goes to the chest instead is claimed later, and none of
 * that was written down. The chest row carried the product and the quantity,
 * so redeeming ran the product's commands with `session.user.name` - the site
 * username, the one thing checkout deliberately did not use - and with none
 * of the fields the buyer filled in. The commands ran; they ran for the wrong
 * person, or for nobody.
 *
 * So the answers travel with the item. What is asked at checkout is asked
 * once, and the chest is where it waits.
 *
 * A request may still carry its own name - an item an operator put in a chest
 * by hand was never bought, so nothing was recorded for it. What is not
 * allowed is falling back to the account's username, which is a name that
 * looks plausible and is wrong.
 */
import { describe, it, expect } from "vitest";
import { deliveryFor, type ChestRow } from "@/modules/store/lib/chest";

const item: ChestRow = {
    productName: "VIP",
    quantity: 2,
    playerName: "Steve_MC",
    variables: { server: "survival" },
};

describe("delivering something claimed from the chest", () => {
    it("uses the name the buyer gave at checkout", () => {
        expect(deliveryFor(item, {})).toMatchObject({ playerName: "Steve_MC" });
    });

    it("carries the fields the buyer filled in", () => {
        expect(deliveryFor(item, {}).variables).toEqual({ server: "survival" });
    });

    it("prefers what the claimer types now over what was recorded", () => {
        // They bought it for one account and are claiming it onto another.
        expect(deliveryFor(item, { playerName: "Alex_MC" }).playerName).toBe("Alex_MC");
    });

    it("asks when nothing was recorded and nothing was typed", () => {
        // An item an operator put in a chest by hand was never bought, so no
        // name was ever taken for it.
        const byHand: ChestRow = { productName: "Rare key", quantity: 1, playerName: null, variables: null };
        expect(deliveryFor(byHand, {})).toEqual({ needsPlayerName: true });
    });

    it("never falls back to the account's username", () => {
        // The one name checkout deliberately did not use. It looks plausible
        // in a log and delivers to the wrong person.
        const byHand: ChestRow = { productName: "Rare key", quantity: 1, playerName: null, variables: null };
        const answer = deliveryFor(byHand, { accountUsername: "steve" });
        expect(answer).toEqual({ needsPlayerName: true });
    });

    it("treats a blank name as no name", () => {
        const blank: ChestRow = { ...item, playerName: "   " };
        expect(deliveryFor(blank, {})).toEqual({ needsPlayerName: true });
        expect(deliveryFor(item, { playerName: "  " }).playerName).toBe("Steve_MC");
    });

    it("passes no fields rather than an empty set when none were filled in", () => {
        const plain: ChestRow = { ...item, variables: null };
        expect(deliveryFor(plain, {}).variables).toBeUndefined();
    });

    it("ignores a fields blob that is not a set of answers", () => {
        // The column is JSON and the row may predate the shape, or have been
        // written by hand. A string where an object belongs must not reach
        // the command builder.
        const odd: ChestRow = { ...item, variables: "survival" };
        expect(deliveryFor(odd, {}).variables).toBeUndefined();
    });

    it("keeps only the answers that are text", () => {
        const mixed: ChestRow = { ...item, variables: { server: "survival", size: 3 } };
        expect(deliveryFor(mixed, {}).variables).toEqual({ server: "survival" });
    });
});
