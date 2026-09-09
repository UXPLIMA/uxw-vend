/**
 * An order an operator types in, for something that happened elsewhere.
 *
 * A shop needs this for the cases the checkout cannot reach: money that came
 * in by bank transfer, a replacement for an order that went wrong, a sale
 * agreed in a message. Without it the only ways to make somebody whole are to
 * hand out a coupon for the full price or to edit the database.
 *
 * The total is worked out here rather than taken from the form. The form is
 * an admin screen, but it is still a client, and a total that arrives from a
 * client is a total somebody can choose: an order that says it was worth
 * nothing goes into the same reports as one that says it was worth a thousand.
 *
 * A bad row is answered, not thrown. A thrown message travels straight into an
 * HTTP response by the shortest path, and then the route is speaking in a
 * helper's words - untranslatable, and one refactor from leaking something
 * internal. What comes back is the row number; the sentence belongs to
 * whoever is speaking.
 */
import { describe, it, expect } from "vitest";
import { manualOrderTotal } from "@/modules/store/lib/manual-order";

describe("what a hand-entered order comes to", () => {
    it("adds the lines up", () => {
        expect(manualOrderTotal([
            { unitAmount: 10, quantity: 2 },
            { unitAmount: 4.5, quantity: 1 },
        ])).toEqual({ total: 24.5 });
    });

    it("comes to nothing for no lines", () => {
        expect(manualOrderTotal([])).toEqual({ total: 0 });
    });

    it("rounds to the penny rather than carrying a fraction of one", () => {
        expect(manualOrderTotal([{ unitAmount: 0.1, quantity: 3 }])).toEqual({ total: 0.3 });
    });

    it("names the row that would take money off the total", () => {
        // A negative line is how a form turns into a discount nobody granted.
        expect(manualOrderTotal([{ unitAmount: 1, quantity: 1 }, { unitAmount: -5, quantity: 1 }]))
            .toEqual({ bad: { line: 2, reason: "negative" } });
        expect(manualOrderTotal([{ unitAmount: 5, quantity: -1 }]))
            .toEqual({ bad: { line: 1, reason: "negative" } });
    });

    it("names the row that is not numbers at all", () => {
        expect(manualOrderTotal([{ unitAmount: Number.NaN, quantity: 1 }]))
            .toEqual({ bad: { line: 1, reason: "not-a-number" } });
    });

    it("allows a line worth nothing, which is what a replacement is", () => {
        expect(manualOrderTotal([{ unitAmount: 0, quantity: 1 }])).toEqual({ total: 0 });
    });
});
