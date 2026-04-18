import { describe, it, expect } from "vitest";
import { sanitizeCustomCss } from "@/core/lib/css-sanitizer";

describe("sanitizeCustomCss", () => {
    it("returns empty string for non-string input", () => {
        expect(sanitizeCustomCss(undefined)).toBe("");
        expect(sanitizeCustomCss(null)).toBe("");
        expect(sanitizeCustomCss(42)).toBe("");
        expect(sanitizeCustomCss({})).toBe("");
    });

    it("passes through benign CSS unchanged", () => {
        const css = "body { color: red; padding: 12px; }";
        expect(sanitizeCustomCss(css)).toBe(css);
    });

    it("strips angle brackets so </style><script> cannot break out", () => {
        const attack = "body {} </style><script>alert(1)</script><style>";
        const out = sanitizeCustomCss(attack);
        // With no < or > the browser cannot re-tokenize a closing style tag
        // or an opening script tag even if this text is fed back into HTML.
        expect(out).not.toContain("<");
        expect(out).not.toContain(">");
    });

    it("removes javascript: URIs", () => {
        const out = sanitizeCustomCss('a { cursor: url("javascript:alert(1)"), auto; }');
        expect(out.toLowerCase()).not.toContain("javascript:");
    });

    it("removes expression() calls", () => {
        const out = sanitizeCustomCss("div { width: expression(alert(1)); }");
        expect(out.toLowerCase()).not.toContain("expression(");
    });

    it("removes behavior: and -moz-binding:", () => {
        const out = sanitizeCustomCss("div { behavior: url(x); -moz-binding: url(y); }");
        expect(out.toLowerCase()).not.toContain("behavior:");
        expect(out.toLowerCase()).not.toContain("-moz-binding:");
    });

    it("strips @import and @charset", () => {
        const out = sanitizeCustomCss('@import url("https://evil.example.com/x.css");');
        expect(out.toLowerCase()).not.toContain("@import");
    });

    it("handles case-insensitive payloads", () => {
        const out = sanitizeCustomCss("BODY { BEHAVIOR: URL(x); }");
        expect(out.toLowerCase()).not.toContain("behavior:");
    });
});
