import { describe, it, expect } from "vitest";
import { parseFooterLinks } from "@/core/lib/footer-links";

describe("parseFooterLinks", () => {
    it("parses a JSON string of links", () => {
        expect(parseFooterLinks('[{"label":"Privacy","href":"/page/privacy"}]')).toEqual([
            { label: "Privacy", href: "/page/privacy", external: false },
        ]);
    });

    it("accepts an already-parsed array (Setting.value is Json)", () => {
        expect(parseFooterLinks([{ label: "Terms", href: "/page/terms" }])).toEqual([
            { label: "Terms", href: "/page/terms", external: false },
        ]);
    });

    it("marks absolute http(s) links external", () => {
        expect(parseFooterLinks('[{"label":"Docs","href":"https://example.test/docs"}]')).toEqual([
            { label: "Docs", href: "https://example.test/docs", external: true },
        ]);
    });

    it("returns an empty list for unset, empty or malformed values", () => {
        for (const raw of [undefined, null, "", "   ", "not json", "{}", '"a string"', 42]) {
            expect(parseFooterLinks(raw)).toEqual([]);
        }
    });

    it("drops entries with a dangerous scheme", () => {
        const raw = JSON.stringify([
            { label: "XSS", href: "javascript:alert(1)" },
            { label: "Data", href: "data:text/html,<script>" },
            { label: "Proto", href: "//evil.test" },
            { label: "Mail", href: "mailto:a@b.test" },
            { label: "Safe", href: "/page/ok" },
        ]);
        expect(parseFooterLinks(raw)).toEqual([{ label: "Safe", href: "/page/ok", external: false }]);
    });

    it("ignores uppercase and padded scheme spellings", () => {
        expect(parseFooterLinks('[{"label":"X","href":" JaVaScRiPt:alert(1)"}]')).toEqual([]);
    });

    it("drops entries missing a label or href", () => {
        const raw = '[{"href":"/a"},{"label":"B"},{"label":"","href":"/c"},{"label":"D","href":"  "},{"label":"E","href":"/e"}]';
        expect(parseFooterLinks(raw)).toEqual([{ label: "E", href: "/e", external: false }]);
    });

    it("skips non-object entries instead of failing the whole list", () => {
        expect(parseFooterLinks('["nope", null, {"label":"Ok","href":"/ok"}]')).toEqual([
            { label: "Ok", href: "/ok", external: false },
        ]);
    });

    it("trims whitespace around label and href", () => {
        expect(parseFooterLinks('[{"label":"  Spaced  ","href":"  /path  "}]')).toEqual([
            { label: "Spaced", href: "/path", external: false },
        ]);
    });

    it("caps the list so a pasted blob cannot blow up the footer", () => {
        const many = Array.from({ length: 50 }, (_, i) => ({ label: `L${i}`, href: `/p${i}` }));
        expect(parseFooterLinks(JSON.stringify(many))).toHaveLength(20);
    });

    it("truncates an over-long label", () => {
        const [link] = parseFooterLinks(JSON.stringify([{ label: "x".repeat(200), href: "/p" }]));
        expect(link.label).toHaveLength(64);
    });
});
