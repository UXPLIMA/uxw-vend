/**
 * The names an operator writes into a message, and whether the event has them.
 *
 * `fillPlaceholders` already made the decision that matters at send time: a
 * name nobody supplied is left in the message rather than blanked, so a typo
 * is visible as `{palyer}` instead of a gap nobody can explain. That is right,
 * and it means the operator finds out in a live channel unless something tells
 * them earlier.
 *
 * So the builder says which names this event does not carry. It says it rather
 * than refusing, because leaving the name visible is a decision this module
 * already made on purpose and a brace an operator meant to type is theirs to
 * type - what they should not have is no warning at all.
 *
 * A warning has to be exactly true to be worth anything, which is what this
 * file defends. The reader here and the substitution over there have to agree
 * about what a placeholder is: every name reported unknown must survive into
 * the sent message, and every name not reported must be replaced. A checker
 * reading a different grammar from the sender is a screen that warns about
 * names that work and stays quiet about ones that do not.
 */
import { describe, it, expect } from "vitest";
import { fillPlaceholders } from "@/modules/discord-integration/lib/placeholders";
import { namesUsed, unknownPlaceholders } from "@/modules/discord-integration/lib/placeholder-check";

describe("reading the names out of what was written", () => {
    it("finds one", () => {
        expect(namesUsed("Welcome {username}")).toEqual(["username"]);
    });

    it("finds each of them once, in the order they appear", () => {
        expect(namesUsed("{a} then {b} then {a}")).toEqual(["a", "b"]);
    });

    it("finds none in a message that carries none", () => {
        expect(namesUsed("A new order")).toEqual([]);
    });

    it("reads nothing out of a brace with no name in it", () => {
        expect(namesUsed("{} and { } and {not a name}")).toEqual([]);
    });
});

describe("what the builder warns about", () => {
    const supplies = ["username", "email"];

    it("says nothing when every name is one the event carries", () => {
        expect(unknownPlaceholders({ title: "Hello {username}", description: "{email}" }, supplies)).toEqual([]);
    });

    it("names the one the event does not carry", () => {
        expect(unknownPlaceholders({ title: "Hello {palyer}" }, supplies)).toEqual(["palyer"]);
    });

    it("looks in every part of the embed, not only the description", () => {
        const found = unknownPlaceholders(
            {
                title: "{one}",
                description: "{two}",
                footer: "{three}",
                fields: [{ name: "{four}", value: "{five}" }],
            },
            supplies,
        );
        expect(found).toEqual(["one", "two", "three", "four", "five"]);
    });

    it("says each name once however many boxes it is in", () => {
        expect(unknownPlaceholders({ title: "{x}", description: "{x}" }, supplies)).toEqual(["x"]);
    });

    it("takes an event that carries nothing as an event that carries nothing", () => {
        expect(unknownPlaceholders({ title: "{username}" }, [])).toEqual(["username"]);
    });
});

describe("the warning and the send agree", () => {
    const supplies = ["username", "total"];
    const values = { username: "aeryn", total: "12.00" };
    const written = "{username} paid {total}, ref {palyer}, and {} stays";

    it("warns about exactly the names that survive into the message", () => {
        const warned = unknownPlaceholders({ description: written }, supplies);
        const sent = fillPlaceholders(written, values);

        for (const name of warned) {
            expect(sent, `warned about ${name} but it was replaced`).toContain(`{${name}}`);
        }
        for (const name of namesUsed(written)) {
            if (warned.includes(name)) continue;
            expect(sent, `did not warn about ${name} but it survived`).not.toContain(`{${name}}`);
        }
    });

    it("does not warn about a brace the sender leaves alone anyway", () => {
        // `{}` is not a placeholder to either of them.
        expect(unknownPlaceholders({ description: "{}" }, supplies)).toEqual([]);
        expect(fillPlaceholders("{}", values)).toBe("{}");
    });

    it("does not warn about a value that arrives looking like a placeholder", () => {
        // The send is one pass, so a member called `{email}` is text. The
        // builder is reading the template, which does not contain it.
        expect(unknownPlaceholders({ description: "Hello {username}" }, supplies)).toEqual([]);
        expect(fillPlaceholders("Hello {username}", { username: "{email}" })).toBe("Hello {email}");
    });
});
