/**
 * Putting the event into the message an operator wrote.
 *
 * They write "{player} bought {product}" and the values arrive with the event.
 * Two decisions, and one of them is a hole.
 *
 * The values come from members. A username, a ticket subject, a product name -
 * all typed by somebody who is not the operator. If a value is substituted and
 * then the result is scanned for placeholders again, a member called
 * `{webhookUrl}` pulls whatever that names into a message, and a member called
 * `{player}` writes their own name in twice. So the pass is single: what a
 * value contains is text, whatever it looks like.
 *
 * The other is what to do with a name nobody supplied. Blanking it hides a
 * typo - the operator sees a sentence with a gap and no idea which word they
 * spelled wrong. Leaving it shows them `{palyer}` in the test send, which is
 * the whole point of a test send.
 */
import { describe, it, expect } from "vitest";
import { fillPlaceholders } from "@/modules/discord-integration/lib/placeholders";

const values = {
    player: "Ada",
    product: "VIP",
    amount: "10.00",
};

describe("a message with the event in it", () => {
    it("puts the values where their names are", () => {
        expect(fillPlaceholders("{player} bought {product}", values)).toBe("Ada bought VIP");
    });

    it("puts the same value in twice when it is named twice", () => {
        expect(fillPlaceholders("{player}, is that you {player}?", values)).toBe("Ada, is that you Ada?");
    });

    it("leaves a name nobody supplied exactly as it was written", () => {
        // The typo an operator needs to see, in the test send, spelled the
        // way they spelled it.
        expect(fillPlaceholders("{palyer} bought {product}", values)).toBe("{palyer} bought VIP");
    });

    it("leaves a message with no names in it alone", () => {
        expect(fillPlaceholders("Somebody bought something", values)).toBe("Somebody bought something");
    });

    it("copes with nothing to say", () => {
        expect(fillPlaceholders("", values)).toBe("");
    });
});

describe("a value that looks like a template", () => {
    it("is not looked at again", () => {
        // A member called `{amount}` would otherwise write the price into
        // the message where their name should be.
        expect(fillPlaceholders("{player} bought {product}", { ...values, player: "{amount}" }))
            .toBe("{amount} bought VIP");
    });

    it("cannot reach a value the message never named", () => {
        const secrets = { ...values, webhookUrl: "https://discord.com/api/webhooks/1/secret" };
        expect(fillPlaceholders("{player} said hello", { ...secrets, player: "{webhookUrl}" }))
            .toBe("{webhookUrl} said hello");
    });

    it("is put in as it was typed, braces and all", () => {
        expect(fillPlaceholders("Hello {player}", { player: "a {b} c" })).toBe("Hello a {b} c");
    });
});

describe("a value that is not a string", () => {
    it("is written the way a reader would write it", () => {
        expect(fillPlaceholders("{count} of them", { count: 3 as unknown as string })).toBe("3 of them");
    });

    it("is left as the name when there is nothing there", () => {
        // Null is a value nobody supplied, not the word "null".
        expect(fillPlaceholders("{who} did it", { who: null as unknown as string })).toBe("{who} did it");
        expect(fillPlaceholders("{who} did it", {})).toBe("{who} did it");
    });
});
