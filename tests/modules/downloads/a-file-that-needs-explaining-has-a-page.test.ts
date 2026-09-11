/**
 * A download that is not self-explanatory.
 *
 * A row in the list is a title, a size and a button, which is everything a
 * rules PDF needs. A launcher or a mod pack is not: there is a thing to
 * install first, an order to do it in, a screenshot of the screen where the
 * setting lives. There was nowhere to put any of that, so it either went in
 * the one-line description or it did not get written down.
 *
 * A file carrying a guide gets a page. One without keeps exactly the shape it
 * had - no link on the title, nothing beside the button - because a link that
 * leads to a repeat of the line below teaches a reader to stop following them.
 *
 * The URL is built from a number that never moves, so renaming a file rewrites
 * the slug and every link already shared still lands.
 */
import { describe, it, expect } from "vitest";
import {
    hasGuide,
    guideHref,
    downloadSlug,
    downloadNumberFrom,
    formatFileSize,
} from "@/modules/downloads/lib/guide";

describe("a file that needs explaining", () => {
    it("has a page", () => {
        expect(hasGuide({ details: "<p>Install this first.</p>" })).toBe(true);
    });

    it("is reached by its number, with the slug alongside", () => {
        expect(guideHref({ number: 4, slug: "launcher", details: "<p>x</p>" }))
            .toBe("/downloads/4/launcher");
    });

    it("is still reachable when the title left no slug behind", () => {
        expect(guideHref({ number: 4, slug: "", details: "<p>x</p>" }))
            .toBe("/downloads/4/file");
    });
});

describe("a file that speaks for itself", () => {
    it("has no page", () => {
        expect(hasGuide({ details: null })).toBe(false);
        expect(hasGuide({ details: "" })).toBe(false);
        // An author who opened the editor, typed nothing and saved.
        expect(hasGuide({ details: "  \n " })).toBe(false);
    });

    it("is not a link somebody can follow to nothing", () => {
        expect(guideHref({ number: 4, slug: "rules", details: null })).toBeNull();
    });
});

describe("the slug beside the number", () => {
    it("is what a reader would expect from the title", () => {
        expect(downloadSlug("Modpack (client)")).toBe("modpack-client");
    });

    it("carries no punctuation into a URL", () => {
        expect(downloadSlug("Map: last season's world")).toBe("map-last-season-s-world");
    });

    it("is bounded, because it is read aloud sometimes", () => {
        expect(downloadSlug("a".repeat(200)).length).toBeLessThanOrEqual(80);
    });

    it("is empty rather than wrong when there is nothing to transliterate", () => {
        // The number is what resolves the page, so an empty slug still works.
        expect(downloadSlug("説明書")).toBe("");
    });
});

describe("the number in the address", () => {
    it("is found past the module's own segment", () => {
        // The catch-all hands over every segment after the locale, so the
        // first one is "downloads". Reading it blindly asks the API for
        // `/downloads/guide/downloads`, gets a 404, and renders "no guide" -
        // which is what a file without one looks like.
        expect(downloadNumberFrom(["downloads", "4", "launcher"])).toBe("4");
        expect(downloadNumberFrom("downloads/4/launcher")).toBe("4");
        expect(downloadNumberFrom(["4", "launcher"])).toBe("4");
    });

    it("is nothing when the segment is not a number", () => {
        expect(downloadNumberFrom(["downloads"])).toBeNull();
        expect(downloadNumberFrom([])).toBeNull();
        expect(downloadNumberFrom(undefined)).toBeNull();
    });
});

describe("a file size", () => {
    it("is read in the units a file manager shows", () => {
        expect(formatFileSize(240_000, "?")).toBe("234.4 KB");
        expect(formatFileSize(62_000_000, "?")).toBe("59.1 MB");
        expect(formatFileSize(900, "?")).toBe("900 B");
    });

    it("says so when nobody recorded one", () => {
        expect(formatFileSize(null, "Unknown")).toBe("Unknown");
        expect(formatFileSize(0, "Unknown")).toBe("Unknown");
    });
});
