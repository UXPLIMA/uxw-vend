import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeInline } from "@/core/lib/sanitize";

/**
 * Every piece of user-submitted rich text — blog articles, forum posts,
 * help articles, custom pages, announcements — passes through here on the
 * way into the database. Sanitising on write means a payload that gets past
 * this function is stored, and every later render serves it; there is no
 * second gate downstream to catch it.
 *
 * This is also the mitigation of record for the rich-text editor's own
 * advisories: the editor runs in the author's browser, this runs on the
 * server, and only this one decides what is persisted.
 */

describe("sanitizeHtml", () => {
    it("keeps the formatting rich text is for", async () => {
        const html = "<p>Hello <strong>world</strong> and <em>friends</em></p>";
        expect(sanitizeHtml(html)).toBe(html);
    });

    it("keeps headings, lists, tables, quotes and code", () => {
        const html =
            "<h2>Title</h2><ul><li>one</li></ul>"
            + "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>"
            + "<blockquote>q</blockquote><pre><code>x = 1</code></pre><hr>";
        const out = sanitizeHtml(html);

        for (const tag of ["h2", "ul", "li", "table", "thead", "th", "td", "blockquote", "pre", "code"]) {
            expect(out).toContain(`<${tag}`);
        }
    });

    it("strips script tags and their contents", () => {
        const out = sanitizeHtml('<p>ok</p><script>fetch("/api/v1/admin/users")</script>');

        expect(out).not.toContain("<script");
        expect(out).not.toContain("fetch(");
        expect(out).toContain("<p>ok</p>");
    });

    it.each([
        ["img onerror", '<img src="x" onerror="alert(1)">', "onerror"],
        ["body onload", '<p onload="alert(1)">x</p>', "onload"],
        ["div onclick", '<div onclick="alert(1)">x</div>', "onclick"],
        ["span onmouseover", '<span onmouseover="alert(1)">x</span>', "onmouseover"],
        ["svg onbegin", '<svg><animate onbegin="alert(1)"/></svg>', "onbegin"],
    ])("strips the %s handler", (_name, dirty, handler) => {
        expect(sanitizeHtml(dirty)).not.toContain(handler);
    });

    it("strips javascript: and data: URLs from links", () => {
        const out = sanitizeHtml(
            '<a href="javascript:alert(1)">a</a>'
            + '<a href="data:text/html;base64,PHNjcmlwdD4=">b</a>',
        );

        expect(out).not.toContain("javascript:");
        expect(out).not.toContain("data:text/html");
    });

    it("keeps ordinary links and images", () => {
        const out = sanitizeHtml(
            '<a href="https://example.com" title="t" target="_blank" rel="noopener">x</a>'
            + '<img src="/uploads/a.png" alt="a">',
        );

        expect(out).toContain('href="https://example.com"');
        expect(out).toContain('target="_blank"');
        expect(out).toContain('src="/uploads/a.png"');
        expect(out).toContain('alt="a"');
    });

    it("strips iframes, forms and the elements that submit them", () => {
        const out = sanitizeHtml(
            '<iframe src="https://evil.test"></iframe>'
            + '<form action="/api/v1/admin"><input name="x"><button>go</button></form>'
            + '<embed src="x"><object data="x"></object>',
        );

        for (const tag of ["<iframe", "<form", "<input", "<button", "<embed", "<object"]) {
            expect(out).not.toContain(tag);
        }
    });

    it("strips style tags and inline style attributes", () => {
        const out = sanitizeHtml(
            '<style>body{display:none}</style><p style="position:fixed;top:0">x</p>',
        );

        // A fixed-position overlay is a clickjacking primitive, and a <style>
        // block can hide or move anything on the page.
        expect(out).not.toContain("<style");
        expect(out).not.toContain("style=");
        expect(out).toContain("x");
    });

    it("drops data-* attributes", () => {
        const out = sanitizeHtml('<div data-controller="admin" data-x="1">x</div>');
        expect(out).not.toContain("data-controller");
        expect(out).not.toContain("data-x");
    });

    it("survives malformed and nested-payload markup", () => {
        // The classic "the sanitiser rewrote it into an attack" shapes.
        expect(sanitizeHtml("<scr<script>ipt>alert(1)</scr</script>ipt>")).not.toContain("<script");
        expect(sanitizeHtml('<<a href="javascript:alert(1)">')).not.toContain("javascript:");
        expect(sanitizeHtml("<p>unclosed")).toContain("unclosed");
    });

    it("returns an empty string for anything that is not a string", () => {
        // Callers pass request bodies straight in; a null must not throw
        // inside a write handler.
        expect(sanitizeHtml(null as never)).toBe("");
        expect(sanitizeHtml(undefined as never)).toBe("");
        expect(sanitizeHtml(42 as never)).toBe("");
        expect(sanitizeHtml({} as never)).toBe("");
        expect(sanitizeHtml("")).toBe("");
    });

    it("is idempotent", () => {
        const dirty = '<p onclick="x()">a<script>b</script><em>c</em></p>';
        const once = sanitizeHtml(dirty);
        expect(sanitizeHtml(once)).toBe(once);
    });
});

describe("sanitizeInline", () => {
    it("keeps only minimal inline formatting", () => {
        const out = sanitizeInline("<strong>a</strong> <em>b</em><br><a href=\"/x\">c</a>");

        expect(out).toContain("<strong>a</strong>");
        expect(out).toContain("<em>b</em>");
        expect(out).toContain("<br");
        expect(out).toContain('href="/x"');
    });

    it("unwraps block-level tags a title field must not carry", () => {
        const out = sanitizeInline("<h1>Title</h1><p>para</p><div>d</div><ul><li>l</li></ul>");

        // The text survives; the structure does not. A heading inside a page
        // title breaks every layout that renders it.
        for (const tag of ["<h1", "<p", "<div", "<ul", "<li"]) {
            expect(out).not.toContain(tag);
        }
        expect(out).toContain("Title");
        expect(out).toContain("para");
    });

    it("strips images, which an inline field never needs", () => {
        expect(sanitizeInline('<img src="x" alt="a">')).not.toContain("<img");
    });

    it("strips scripts and event handlers", () => {
        const out = sanitizeInline('<script>alert(1)</script><strong onclick="alert(2)">x</strong>');

        expect(out).not.toContain("<script");
        expect(out).not.toContain("onclick");
        expect(out).toContain("x");
    });

    it("strips javascript: hrefs", () => {
        expect(sanitizeInline('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    });

    it("returns an empty string for anything that is not a string", () => {
        expect(sanitizeInline(null as never)).toBe("");
        expect(sanitizeInline(undefined as never)).toBe("");
        expect(sanitizeInline(7 as never)).toBe("");
    });

    it("is stricter than sanitizeHtml on the same input", () => {
        const html = "<h1>T</h1><p>body</p>";
        expect(sanitizeHtml(html)).toContain("<h1");
        expect(sanitizeInline(html)).not.toContain("<h1");
    });
});
