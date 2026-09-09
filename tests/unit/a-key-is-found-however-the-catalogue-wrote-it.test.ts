/**
 * Finding one string in a catalogue that is written two ways.
 *
 * A catalogue entry may be nested - `{ "err": { "demo": "..." } }` - or flat,
 * `{ "err.demo": "..." }`. Both are accepted on the way in and both end up
 * nested by the time next-intl sees them, so a lookup that only walks dots
 * misses half the file and a lookup that only reads the whole key misses the
 * other half.
 *
 * The translation editor needs this to answer one question: what does this
 * version ship for this key? That answer is what an edit is judged against
 * and what reverting an edit puts back, so a miss is not cosmetic - it turns
 * into "this string cannot be restored".
 */
import { describe, it, expect } from "vitest";
import { messageAt } from "@/core/lib/i18n/shipped-messages";

describe("finding a shipped string", () => {
    it("reads a plain key", () => {
        expect(messageAt({ title: "Orders" }, "title")).toBe("Orders");
    });

    it("walks the dots when the catalogue nested it", () => {
        expect(messageAt({ err: { demo: "Not here" } }, "err.demo")).toBe("Not here");
    });

    it("reads the whole key when the catalogue wrote it flat", () => {
        expect(messageAt({ "err.demo": "Not here" }, "err.demo")).toBe("Not here");
    });

    it("returns nothing for a key the catalogue does not carry", () => {
        expect(messageAt({ title: "Orders" }, "subtitle")).toBeNull();
    });

    it("returns nothing when the path runs into a string early", () => {
        expect(messageAt({ err: "Not here" }, "err.demo")).toBeNull();
    });

    it("returns nothing when the key names a branch rather than a string", () => {
        expect(messageAt({ err: { demo: "Not here" } }, "err")).toBeNull();
    });

    it("refuses a key that reaches for the prototype", () => {
        expect(messageAt({ title: "Orders" }, "__proto__.polluted")).toBeNull();
        expect(messageAt({ title: "Orders" }, "constructor")).toBeNull();
    });
});
