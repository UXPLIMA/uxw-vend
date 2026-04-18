import { describe, it, expect } from "vitest";
import { sanitizeSvg } from "@/core/lib/svg-sanitizer";

describe("sanitizeSvg", () => {
    it("returns empty string for empty input", () => {
        expect(sanitizeSvg("")).toBe("");
    });

    it("strips <script> blocks entirely", () => {
        const evil = '<svg><script>alert(1)</script><rect/></svg>';
        const out = sanitizeSvg(evil);
        expect(out.toLowerCase()).not.toContain("<script");
        expect(out.toLowerCase()).not.toContain("</script");
    });

    it("strips <foreignObject> which can host HTML/JS", () => {
        const evil = '<svg><foreignObject><iframe/></foreignObject></svg>';
        const out = sanitizeSvg(evil);
        expect(out.toLowerCase()).not.toContain("<foreignobject");
        expect(out.toLowerCase()).not.toContain("<iframe");
    });

    it("strips inline event handlers like onload=", () => {
        const evil = '<svg onload="alert(1)" onclick="evil()"><circle/></svg>';
        const out = sanitizeSvg(evil);
        expect(out.toLowerCase()).not.toContain("onload");
        expect(out.toLowerCase()).not.toContain("onclick");
    });

    it("strips javascript: href", () => {
        const evil = '<svg><a href="javascript:alert(1)"><rect/></a></svg>';
        const out = sanitizeSvg(evil);
        expect(out.toLowerCase()).not.toContain("javascript:");
    });

    it("strips xlink:href javascript:", () => {
        const evil = '<svg><use xlink:href="javascript:alert(1)"/></svg>';
        const out = sanitizeSvg(evil);
        expect(out.toLowerCase()).not.toContain("javascript:");
    });

    it("strips data:text/html", () => {
        const evil = '<svg><a href="data:text/html,<script>alert(1)</script>"/></svg>';
        const out = sanitizeSvg(evil);
        expect(out.toLowerCase()).not.toContain("data:text/html");
    });

    it("preserves benign svg content", () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="red"/></svg>';
        const out = sanitizeSvg(svg);
        expect(out).toContain("<rect");
        expect(out).toContain('fill="red"');
    });
});
