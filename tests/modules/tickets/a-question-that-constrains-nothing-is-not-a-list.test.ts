/**
 * The extra questions a department asks, as an operator writes them.
 *
 * `fields.ts` already decided what happens to the answers: the label is stored
 * beside the value so a ticket keeps its question when the question is
 * renamed, and an answer to something this department does not ask is dropped.
 * This is the other end - what an operator is allowed to create in the first
 * place.
 *
 * The refusal that matters is the select with no options. `answersFor` checks
 * membership only when there is a list to check against, which is right: a
 * field that has lost its options should not start rejecting every answer on
 * old tickets. But it means a select an operator created and never filled in
 * accepts anything at all. They have made a dropdown, the form has nothing to
 * drop down, and whatever arrives is stored as though it had been chosen. That
 * is a control which appears to constrain and does not, and the only place it
 * can be caught is here, before it is saved.
 *
 * The key is the other half. It is what the form posts and what the answer is
 * filed under, so two fields sharing one is two questions with one answer, and
 * a key that is not a plain name is a key nobody can post reliably.
 */
import { describe, it, expect } from "vitest";
import { answersFor } from "@/modules/tickets/lib/fields";
import { checkFields } from "@/modules/tickets/lib/field-draft";

const field = (over: Record<string, unknown> = {}) => ({
    key: "order_number",
    label: "Order number",
    type: "text",
    required: false,
    options: [] as string[],
    ...over,
});

describe("what an operator may ask", () => {
    it("takes a plain text question", () => {
        expect(checkFields([field()])).toBeNull();
    });

    it("takes a department that asks nothing at all", () => {
        expect(checkFields([])).toBeNull();
    });

    it("takes a select with a list to choose from", () => {
        expect(checkFields([field({ type: "select", options: ["PC", "Mobile"] })])).toBeNull();
    });

    it("refuses a select with no list, which would constrain nothing", () => {
        expect(checkFields([field({ type: "select", options: [] })])).toEqual({
            reason: "select_without_options",
            key: "order_number",
        });
    });

    it("refuses a select whose only options are blank", () => {
        expect(checkFields([field({ type: "select", options: ["  ", ""] })])?.reason)
            .toBe("select_without_options");
    });

    it("refuses the same option twice, because it is one choice", () => {
        expect(checkFields([field({ type: "select", options: ["PC", "PC"] })])?.reason)
            .toBe("repeated_option");
    });

    it("refuses two questions filed under one key", () => {
        expect(checkFields([field(), field({ label: "Another" })])).toEqual({
            reason: "repeated_key",
            key: "order_number",
        });
    });

    it("refuses a key that is not a plain name", () => {
        for (const key of ["", "  ", "order number", "order-number", "__proto__", "1st"]) {
            expect(checkFields([field({ key })])?.reason, key).toBe("bad_key");
        }
    });

    it("refuses a question with nothing written on it", () => {
        expect(checkFields([field({ label: "   " })])?.reason).toBe("no_label");
    });
});

describe("what the form then does with them", () => {
    it("holds a select to its list", () => {
        const fields = [field({ type: "select", options: ["PC", "Mobile"] })];
        expect(checkFields(fields)).toBeNull();
        expect(answersFor(fields, { order_number: "Console" })).toEqual({ notOnTheList: "order_number" });
        expect(answersFor(fields, { order_number: "PC" })).toEqual({
            answers: [{ key: "order_number", label: "Order number", value: "PC" }],
        });
    });

    it("asks for a required answer before it will open the ticket", () => {
        const fields = [field({ required: true })];
        expect(checkFields(fields)).toBeNull();
        expect(answersFor(fields, {})).toEqual({ missing: ["order_number"] });
    });

    it("stores nothing for an optional question nobody answered", () => {
        expect(answersFor([field()], { order_number: "  " })).toEqual({ answers: [] });
    });
});
