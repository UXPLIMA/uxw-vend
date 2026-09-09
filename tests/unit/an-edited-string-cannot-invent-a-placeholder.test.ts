/**
 * What an operator is allowed to do to a shipped string.
 *
 * The translation editor hands an operator every string the site renders,
 * which includes the ones carrying values: "{count} orders", "Welcome back,
 * {name}". A caller passes exactly the values the shipped string asked for and
 * nothing else, so a string that names a value the caller does not pass stops
 * formatting: next-intl catches the error and renders the key, and the reader
 * sees `store.adm_ordersTotal` where a sentence was. Braces left unclosed do
 * the same at parse time.
 *
 * Dropping a placeholder is the operator's business - a translation may not
 * need the number. Inventing one is not, because nothing will ever supply it.
 * So the rule is one-directional, and it is checked against what the software
 * ships rather than against what is in the table, which may already be an
 * edit.
 *
 * The reading has to be structural. A plural's options are messages of their
 * own, so the `orders` in `other {orders}` is a word and the `count` in front
 * of it is a value, and a reader that only looks for braces cannot tell them
 * apart.
 */
import { describe, it, expect } from "vitest";
import { readPlaceholders, checkMessageEdit } from "@/core/lib/message-edit";

describe("reading the values a message asks for", () => {
    it("finds a plain one", () => {
        expect(readPlaceholders("Welcome back, {name}")).toEqual({ names: ["name"], wellFormed: true });
    });

    it("finds none in a message that carries none", () => {
        expect(readPlaceholders("Orders")).toEqual({ names: [], wellFormed: true });
    });

    it("takes the argument of a plural and leaves its words alone", () => {
        const read = readPlaceholders("{count, plural, one {# order} other {orders}}");
        expect(read).toEqual({ names: ["count"], wellFormed: true });
    });

    it("finds a value used inside a plural option", () => {
        const read = readPlaceholders("{count, plural, other {# waiting for {name}}}");
        expect(read.names).toEqual(["count", "name"]);
    });

    it("reads a quoted brace as text", () => {
        expect(readPlaceholders("'{'name'}' is literal")).toEqual({ names: [], wellFormed: true });
    });

    it("says so when a brace is never closed", () => {
        expect(readPlaceholders("{count orders").wellFormed).toBe(false);
    });

    it("says so when a brace closes nothing", () => {
        expect(readPlaceholders("orders}").wellFormed).toBe(false);
    });

    it("says so when a value has no name", () => {
        expect(readPlaceholders("{} orders").wellFormed).toBe(false);
    });
});

describe("an edit to a shipped string", () => {
    it("is allowed when it keeps the same values", () => {
        expect(checkMessageEdit("{count} orders", "{count} siparis")).toBeNull();
    });

    it("is allowed when it drops one, because a translation may not need it", () => {
        expect(checkMessageEdit("{count} orders", "Siparisler")).toBeNull();
    });

    it("is refused when it invents one, and says which", () => {
        const refusal = checkMessageEdit("{count} orders", "{count} of {total} siparis");
        expect(refusal).toEqual({ reason: "new_placeholder", names: ["total"] });
    });

    it("is allowed to move a value into a plural option the shipped string already named", () => {
        expect(checkMessageEdit("{count, plural, other {# for {name}}}", "{name}: {count}")).toBeNull();
    });

    it("is refused when it leaves a brace open", () => {
        expect(checkMessageEdit("{count} orders", "{count siparis")).toEqual({ reason: "malformed" });
    });

    it("is refused when it is empty, because a key is not a sentence", () => {
        expect(checkMessageEdit("Orders", "   ")).toEqual({ reason: "empty" });
    });

    it("is refused when it is longer than the column is meant to hold", () => {
        expect(checkMessageEdit("Orders", "x".repeat(5001))).toEqual({ reason: "too_long" });
    });

    it("lets any sound string through when the shipped one is itself broken", () => {
        // Otherwise the one screen that can repair a broken string is the one
        // screen that refuses to.
        expect(checkMessageEdit("{count orders", "{count} siparis")).toBeNull();
    });
});
