import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadFromUrl } from "@/core/lib/download";

/**
 * The point of this helper is that a failed download must not navigate the
 * admin away from the page they were on - the reason it exists instead of
 * `window.location.href = url`. That guarantee rests on details the browser
 * does not enforce: the anchor must actually be clicked, and it must be
 * removed again so repeated exports cannot litter the DOM.
 */

interface Click { el: HTMLAnchorElement; parentAtClick: ParentNode | null }

let clicked: Click[];
let realClick: () => void;

beforeEach(() => {
    clicked = [];
    realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        // The helper removes the anchor immediately after clicking, so the
        // attachment has to be recorded here rather than asserted later.
        clicked.push({ el: this, parentAtClick: this.parentNode });
    };
});

afterEach(() => {
    HTMLAnchorElement.prototype.click = realClick;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

describe("downloadFromUrl", () => {
    it("clicks a synthetic anchor pointing at the url", async () => {
        downloadFromUrl("/api/admin/export.csv");

        expect(clicked).toHaveLength(1);
        expect(clicked[0]!.el.getAttribute("href")).toBe("/api/admin/export.csv");
    });

    it("sets the requested filename", () => {
        downloadFromUrl("/api/x", "users.csv");
        expect(clicked[0]!.el.download).toBe("users.csv");
    });

    it("leaves the filename to the server when none is given", () => {
        downloadFromUrl("/api/x");
        expect(clicked[0]!.el.download).toBe("");
    });

    it("marks the anchor noopener", () => {
        downloadFromUrl("/api/x");
        expect(clicked[0]!.el.rel).toBe("noopener");
    });

    it("keeps the anchor invisible while it is in the document", () => {
        downloadFromUrl("/api/x");
        expect(clicked[0]!.el.style.display).toBe("none");
    });

    it("was attached to the document at click time", () => {
        downloadFromUrl("/api/x");
        // A detached anchor's click is a no-op in some browsers.
        expect(clicked[0]!.parentAtClick).toBe(document.body);
    });

    it("removes the anchor afterwards", () => {
        downloadFromUrl("/api/x");
        expect(document.querySelectorAll("a")).toHaveLength(0);
    });

    it("leaves nothing behind across repeated exports", () => {
        downloadFromUrl("/api/a", "a.csv");
        downloadFromUrl("/api/b", "b.csv");
        downloadFromUrl("/api/c", "c.csv");

        expect(clicked).toHaveLength(3);
        expect(document.body.children).toHaveLength(0);
    });

    it("never navigates the current page", () => {
        const before = window.location.href;
        downloadFromUrl("/api/x");
        expect(window.location.href).toBe(before);
    });
});
