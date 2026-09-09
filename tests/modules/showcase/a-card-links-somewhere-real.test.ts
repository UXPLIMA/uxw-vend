/**
 * A grid of cards: a picture, a heading, a line of text, and somewhere to go.
 *
 * All four are typed into a box by an operator, and two of them are addresses
 * the browser is handed directly. An address a person typed is the same
 * hazard here as everywhere else on this site, and it arrives with two extra
 * spellings that a redirect never had to worry about:
 *
 *  - `javascript:` in a link is script execution on click, in the reader's
 *    session, on a page they trust. It is the oldest one there is and it still
 *    works, because a href is not a URL until a browser decides it is;
 *  - `data:` in an image is a document the page renders without fetching
 *    anything, which is how an SVG becomes a script.
 *
 * So a card's link and a card's picture are each either a path on this site or
 * a whole https address, and anything else is dropped. Dropped, not escaped:
 * a card that renders without its link is a card, and a card that renders with
 * a link nobody can explain is a trap.
 */
import { describe, it, expect } from "vitest";
import { cardLink, cardImage } from "@/modules/showcase/lib/card";

describe("where a card sends a reader", () => {
    it("takes a path on this site", () => {
        expect(cardLink("/store")).toBe("/store");
        expect(cardLink("/store/product/1?ref=home")).toBe("/store/product/1?ref=home");
    });

    it("takes a whole https address", () => {
        expect(cardLink("https://example.com/page")).toBe("https://example.com/page");
    });

    it("drops a script", () => {
        for (const attempt of [
            "javascript:alert(1)",
            "JavaScript:alert(1)",
            "  javascript:alert(1)  ",
            "java\tscript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "vbscript:msgbox(1)",
        ]) {
            expect(cardLink(attempt), attempt).toBeNull();
        }
    });

    it("drops something that only looks like a path", () => {
        // Reads as a path to whoever typed it, as another site to a browser.
        expect(cardLink("//evil.example")).toBeNull();
        expect(cardLink("/\\evil.example")).toBeNull();
    });

    it("drops an address that is not https", () => {
        expect(cardLink("http://example.com")).toBeNull();
        expect(cardLink("ftp://example.com")).toBeNull();
    });

    it("drops nothing at all, which is a card with no link", () => {
        expect(cardLink("")).toBeNull();
        expect(cardLink("   ")).toBeNull();
        expect(cardLink(null)).toBeNull();
    });
});

describe("the picture on a card", () => {
    it("takes one this site is serving", () => {
        expect(cardImage("/uploads/showcase/one.png")).toBe("/uploads/showcase/one.png");
    });

    it("takes one from somewhere else over https", () => {
        expect(cardImage("https://cdn.example.com/one.png")).toBe("https://cdn.example.com/one.png");
    });

    it("drops a document pretending to be a picture", () => {
        // An SVG in a data URL is a script the page renders without fetching
        // anything.
        expect(cardImage("data:image/svg+xml,<svg onload=alert(1)>")).toBeNull();
        expect(cardImage("javascript:alert(1)")).toBeNull();
    });

    it("drops one served without encryption", () => {
        // A mixed-content image is blocked by the browser anyway, so it is a
        // broken card rather than a picture.
        expect(cardImage("http://cdn.example.com/one.png")).toBeNull();
    });

    it("drops nothing at all, which is a card with no picture", () => {
        expect(cardImage("")).toBeNull();
        expect(cardImage(null)).toBeNull();
    });
});
