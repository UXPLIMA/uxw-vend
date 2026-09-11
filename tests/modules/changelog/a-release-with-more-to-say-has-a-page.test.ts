/**
 * A release entry that needs more than a line.
 *
 * The changelog is a timeline, and a timeline is a list: a version, a word
 * about what changed, the date. That is the right shape for most releases and
 * the wrong one for the few that need explaining - the screenshot of the new
 * screen, the reason the third attempt was the one that shipped, the two steps
 * an operator has to take before the next restart.
 *
 * So an entry can carry a long form, and when it does it gets a page. When it
 * does not, nothing about the timeline changes: no link, no affordance, no
 * suggestion that there is something behind the title. A link that leads to a
 * copy of the line above it teaches a reader that the links here are not worth
 * following, which costs more than the one entry it was added for.
 *
 * The URL is built from a number that never moves. A slug taken from the title
 * would break every shared link the first time somebody fixed a typo in it.
 */
import { describe, it, expect } from "vitest";
import { hasPage, entryHref, entrySlug, entryNumberFrom } from "@/modules/changelog/lib/entry-page";

describe("a release with more to say", () => {
    it("has a page", () => {
        expect(hasPage({ details: "<p>Here is why.</p>" })).toBe(true);
    });

    it("is reached by its number, with the slug alongside", () => {
        expect(entryHref({ number: 14, slug: "backups-run-twice-a-day", details: "<p>x</p>" }))
            .toBe("/changelog/14/backups-run-twice-a-day");
    });

    it("is still reachable when the title left no slug behind", () => {
        // A title written entirely in a script with no ASCII slugifies to
        // nothing. The number is what resolves the page, so the link works.
        expect(entryHref({ number: 14, slug: "", details: "<p>x</p>" }))
            .toBe("/changelog/14/release");
    });
});

describe("a release that said everything on the timeline", () => {
    it("has no page", () => {
        expect(hasPage({ details: null })).toBe(false);
        expect(hasPage({ details: undefined })).toBe(false);
        expect(hasPage({ details: "" })).toBe(false);
    });

    it("is not a link somebody can follow to nothing", () => {
        expect(entryHref({ number: 14, slug: "x", details: null })).toBeNull();
    });

    it("counts whitespace as nothing, because a rich text editor leaves some", () => {
        expect(hasPage({ details: "   \n  " })).toBe(false);
    });
});

describe("the slug beside the number", () => {
    it("is what a reader would expect from the title", () => {
        expect(entrySlug("Backups now run twice a day")).toBe("backups-now-run-twice-a-day");
    });

    it("carries no punctuation into a URL", () => {
        expect(entrySlug("Fixed: the 'gift' flow (finally!)")).toBe("fixed-the-gift-flow-finally");
    });

    it("is bounded, because it is read aloud sometimes", () => {
        expect(entrySlug("a".repeat(200)).length).toBeLessThanOrEqual(80);
    });

    it("is empty rather than wrong when there is nothing to transliterate", () => {
        expect(entrySlug("更新情報")).toBe("");
    });
});

/**
 * What the module page router actually hands a page mounted on a catch-all.
 *
 * Every segment after the locale, module path included. Reading the first one
 * asks the API for `/changelog/entry/changelog`, which answers 404, which the
 * page renders as "this release has nothing more to show" - the same thing it
 * shows for an entry that really has none. So the page looked like it worked
 * and was wrong for every entry, which is the shape of bug that survives a
 * demo.
 */
describe("the number in the address", () => {
    it("is found past the module's own segment", () => {
        expect(entryNumberFrom(["changelog", "14", "backups-run-twice-a-day"])).toBe("14");
    });

    it("is found when the router hands over a path rather than an array", () => {
        expect(entryNumberFrom("changelog/14/backups-run-twice-a-day")).toBe("14");
    });

    it("is found when the module's segment is not there at all", () => {
        expect(entryNumberFrom(["14", "backups"])).toBe("14");
    });

    it("is nothing when the segment is not a number", () => {
        // The failure this exists for: "changelog" read as the number.
        expect(entryNumberFrom(["changelog"])).toBeNull();
        expect(entryNumberFrom(["changelog", "not-a-number"])).toBeNull();
        expect(entryNumberFrom([])).toBeNull();
        expect(entryNumberFrom(undefined)).toBeNull();
    });
});
