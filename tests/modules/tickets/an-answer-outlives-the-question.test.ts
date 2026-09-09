/**
 * Extra questions on a support form, and what happens to the answers later.
 *
 * A billing department wants an order number, a bug report wants a version, a
 * ban appeal wants an in-game name. An operator adds those questions per
 * department, and everything interesting happens afterwards.
 *
 * The answers outlive the questions. An operator renames "Order no." to "Order
 * number", or deletes the field entirely once a season ends, and every ticket
 * ever opened with it is still in the queue being read by somebody. If the
 * answer is stored as a key and the label is looked up when it is shown, those
 * tickets lose their questions: an agent reads a value with nothing above it,
 * or nothing at all. So the label is written down with the answer, at the
 * moment it was answered.
 *
 * The other half is what a request is allowed to store. A form posts keys, and
 * a request is not a form: an answer to a key that is not a question on this
 * department is somebody writing into a ticket, and it is dropped rather than
 * kept for later.
 */
import { describe, it, expect } from "vitest";
import { answersFor } from "@/modules/tickets/lib/fields";

const fields = [
    { key: "order_no", label: "Order number", type: "text", required: true, options: [] },
    { key: "version", label: "Game version", type: "text", required: false, options: [] },
    { key: "platform", label: "Platform", type: "select", required: false, options: ["PC", "Console"] },
];

describe("what a ticket stores", () => {
    it("keeps an answer with the question as it was asked", () => {
        // Not the key alone: renaming the field later must not rewrite what
        // an agent reads on a ticket from last year.
        expect(answersFor(fields, { order_no: "ORD-1" })).toEqual({
            answers: [{ key: "order_no", label: "Order number", value: "ORD-1" }],
        });
    });

    it("keeps them in the order they were asked", () => {
        const given = { version: "1.4", order_no: "ORD-1" };
        expect(answersFor(fields, given)).toEqual({
            answers: [
                { key: "order_no", label: "Order number", value: "ORD-1" },
                { key: "version", label: "Game version", value: "1.4" },
            ],
        });
    });

    it("stores nothing for an optional question nobody answered", () => {
        // An empty entry reads as "asked and left blank" on a ticket, which is
        // a different thing from "not asked".
        const answered = answersFor(fields, { order_no: "ORD-1", version: "  " });
        expect(answered).toEqual({ answers: [{ key: "order_no", label: "Order number", value: "ORD-1" }] });
    });

    it("drops an answer to a question this department does not ask", () => {
        // A form posts keys and a request is not a form.
        expect(answersFor(fields, { order_no: "ORD-1", isAdmin: "true" })).toEqual({
            answers: [{ key: "order_no", label: "Order number", value: "ORD-1" }],
        });
    });
});

describe("a question that has to be answered", () => {
    it("stops the ticket, and says which one", () => {
        // Named, so the form marks the box rather than saying something is
        // missing over a page of them.
        expect(answersFor(fields, {})).toEqual({ missing: ["order_no"] });
        expect(answersFor(fields, { order_no: "   " })).toEqual({ missing: ["order_no"] });
    });

    it("names all of them at once", () => {
        const two = [...fields, { key: "email", label: "Contact", type: "text", required: true, options: [] }];
        expect(answersFor(two, {})).toEqual({ missing: ["order_no", "email"] });
    });
});

describe("a question with a list of answers", () => {
    it("takes one from the list", () => {
        expect(answersFor(fields, { order_no: "ORD-1", platform: "PC" })).toEqual({
            answers: [
                { key: "order_no", label: "Order number", value: "ORD-1" },
                { key: "platform", label: "Platform", value: "PC" },
            ],
        });
    });

    it("refuses one that is not on it", () => {
        // The list is the question. An answer outside it is a request that
        // did not come from the form.
        expect(answersFor(fields, { order_no: "ORD-1", platform: "Fridge" }))
            .toEqual({ notOnTheList: "platform" });
    });
});

describe("a department that asks nothing", () => {
    it("stores nothing and stops nobody", () => {
        expect(answersFor([], { anything: "at all" })).toEqual({ answers: [] });
    });
});
