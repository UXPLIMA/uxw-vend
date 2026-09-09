/**
 * Letting an operator design the message, and the limits they cannot see.
 *
 * The embeds were written in code, one per event. An operator who wanted their
 * own wording, their own colour, or a field the author had not thought of had
 * to edit a file. So they get a builder - and with it, every way an embed can
 * be refused by a service that answers "400" and nothing else.
 *
 * The limits are per part and also across all of them. A title of 256, a
 * description of 4096 and twenty-five fields are each fine on their own and
 * add up to a message Discord will not take: the total across everything with
 * words in it is six thousand characters, and going over it rejects the whole
 * message rather than trimming it.
 *
 * That is the one an operator cannot find. Each box on their screen is inside
 * its own limit, the preview looks right, and the message never arrives. So it
 * is checked here, before it is sent, and the answer names which limit and by
 * how much rather than saying it did not work.
 */
import { describe, it, expect } from "vitest";
import { embedRefusal, LIMITS } from "@/modules/discord-integration/lib/embed-limits";

const ok = {
    title: "A new order",
    description: "Somebody bought something.",
    fields: [{ name: "Total", value: "10.00", inline: true }],
    footer: { text: "uxwVend" },
};

describe("an embed within its limits", () => {
    it("is accepted", () => {
        expect(embedRefusal(ok)).toBeNull();
    });

    it("is accepted with nothing in it at all", () => {
        // An operator who has only picked a colour so far.
        expect(embedRefusal({})).toBeNull();
    });
});

describe("a part over its own limit", () => {
    it("names the title", () => {
        expect(embedRefusal({ ...ok, title: "x".repeat(LIMITS.title + 1) }))
            .toEqual({ over: "title", limit: LIMITS.title, by: 1 });
    });

    it("names the description", () => {
        expect(embedRefusal({ ...ok, description: "x".repeat(LIMITS.description + 10) }))
            .toEqual({ over: "description", limit: LIMITS.description, by: 10 });
    });

    it("names a field by its position, because they have no names to give", () => {
        const fields = [ok.fields[0], { name: "x".repeat(LIMITS.fieldName + 1), value: "v" }];
        expect(embedRefusal({ ...ok, fields }))
            .toEqual({ over: "field 2 name", limit: LIMITS.fieldName, by: 1 });
    });

    it("names a field's value", () => {
        const fields = [{ name: "n", value: "x".repeat(LIMITS.fieldValue + 5) }];
        expect(embedRefusal({ ...ok, fields }))
            .toEqual({ over: "field 1 value", limit: LIMITS.fieldValue, by: 5 });
    });

    it("names the footer", () => {
        expect(embedRefusal({ ...ok, footer: { text: "x".repeat(LIMITS.footer + 2) } }))
            .toEqual({ over: "footer", limit: LIMITS.footer, by: 2 });
    });

    it("counts the fields", () => {
        const many = Array.from({ length: LIMITS.fields + 1 }, (_, i) => ({ name: `n${i}`, value: "v" }));
        expect(embedRefusal({ ...ok, fields: many }))
            .toEqual({ over: "fields", limit: LIMITS.fields, by: 1 });
    });
});

describe("the limit an operator cannot see", () => {
    it("is the total across everything with words in it", () => {
        // Each part inside its own limit, the preview looking right, and the
        // message never arriving.
        const fields = Array.from({ length: 20 }, (_, i) => ({
            name: `n${i}`,
            value: "x".repeat(200),
        }));
        const over = { title: "x".repeat(200), description: "x".repeat(2000), fields };
        const answer = embedRefusal(over);
        expect(answer).toMatchObject({ over: "everything", limit: LIMITS.total });
        expect(answer && "by" in answer && answer.by).toBeGreaterThan(0);
    });

    it("counts the title, the description, every field and the footer", () => {
        // Every part inside its own limit, on purpose: 200 + 4000 + 1800 is
        // exactly the total, and one more character is one too many.
        const justOn = {
            title: "x".repeat(200),
            description: "x".repeat(4000),
            footer: { text: "x".repeat(1800) },
        };
        expect(embedRefusal(justOn)).toBeNull();

        const justOver = { ...justOn, footer: { text: "x".repeat(1801) } };
        expect(embedRefusal(justOver)).toEqual({ over: "everything", limit: LIMITS.total, by: 1 });
    });
});

describe("the order the refusals come in", () => {
    it("names a part before the total, because that is the box they are in", () => {
        // Both are over. The one they can point at is the one to say.
        const both = {
            title: "x".repeat(LIMITS.title + 1),
            description: "x".repeat(LIMITS.total),
        };
        expect(embedRefusal(both)).toMatchObject({ over: "title" });
    });
});
