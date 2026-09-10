/**
 * What a listing may carry for whoever hands it over.
 *
 * The market moves credits and takes a cut and does not know what is being
 * sold - that is the whole design, and `delivery.ts` says so twice. The
 * payload belongs to the module that claims the kind, which is why the hook
 * contract types it `unknown` and the claiming module narrows it.
 *
 * The listing endpoint did not agree. It took `Record<string, string>`, so a
 * provider whose listing needs a number could not be written at all: the first
 * one ever built asks for a role and a number of days, and a seller filling
 * that in got a 400. The market was deciding the shape of something it says it
 * knows nothing about.
 *
 * Bounded rather than open, though. This arrives from a member, it is stored
 * as JSON and handed to whatever claims the kind, so the size and the depth
 * are the market's business even when the meaning is not.
 */
import { describe, it, expect } from "vitest";
import { readListingPayload } from "@/modules/marketplace/lib/payload";

describe("what a seller may put in a listing", () => {
    it("takes the shape the first provider actually needs", () => {
        expect(readListingPayload({ roleId: "gold", days: 30 }))
            .toEqual({ payload: { roleId: "gold", days: 30 } });
    });

    it("takes strings, numbers and flags, because a payload is data", () => {
        expect(readListingPayload({ a: "text", b: 12, c: true, d: false }))
            .toEqual({ payload: { a: "text", b: 12, c: true, d: false } });
    });

    it("takes nothing at all, for a kind that needs nothing", () => {
        expect(readListingPayload(undefined)).toEqual({ payload: undefined });
    });

    it("takes an empty object as an empty object", () => {
        expect(readListingPayload({})).toEqual({ payload: {} });
    });
});

describe("what it may not", () => {
    it("refuses anything that is not an object", () => {
        for (const bad of ["text", 12, true, null, [1, 2]]) {
            expect(readListingPayload(bad), JSON.stringify(bad)).toEqual({ refuse: "bad_payload" });
        }
    });

    it("refuses a value that is not a plain one", () => {
        // Nesting is where a bounded payload stops being bounded, and no
        // provider has needed it.
        expect(readListingPayload({ a: { b: 1 } })).toEqual({ refuse: "bad_payload" });
        expect(readListingPayload({ a: [1] })).toEqual({ refuse: "bad_payload" });
        expect(readListingPayload({ a: null })).toEqual({ refuse: "bad_payload" });
    });

    it("refuses a number that is not one", () => {
        expect(readListingPayload({ days: Number.NaN })).toEqual({ refuse: "bad_payload" });
        expect(readListingPayload({ days: Number.POSITIVE_INFINITY })).toEqual({ refuse: "bad_payload" });
    });

    it("refuses more keys than any listing needs", () => {
        const wide = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`k${i}`, "v"]));
        expect(readListingPayload(wide)).toEqual({ refuse: "bad_payload" });
    });

    it("refuses a value longer than a field somebody typed", () => {
        expect(readListingPayload({ a: "x".repeat(501) })).toEqual({ refuse: "bad_payload" });
    });

    it("refuses a key that would reach the prototype", () => {
        // Through `JSON.parse` and a computed key, which are the two ways the
        // name arrives as an own property. Written as a plain object literal
        // it sets the prototype instead and never becomes a key at all, which
        // is why a test that only used one would prove nothing - and this
        // payload arrives as parsed JSON.
        expect(readListingPayload(JSON.parse('{"__proto__": "x"}'))).toEqual({ refuse: "bad_payload" });
        expect(readListingPayload({ ["__proto__"]: "x" })).toEqual({ refuse: "bad_payload" });
        expect(readListingPayload({ constructor: "x" })).toEqual({ refuse: "bad_payload" });
        expect(readListingPayload({ prototype: "x" })).toEqual({ refuse: "bad_payload" });
    });
});
