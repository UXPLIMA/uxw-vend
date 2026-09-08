/**
 * The topic list is spaced by a gap, not by a margin.
 *
 * The rows sat flush against each other and the obvious fix - raising
 * `space-y-3` to `space-y-4` on the container - changed nothing at all.
 * `space-y-*` puts a vertical margin on each child; each row is a `<Link>`;
 * an anchor is `display: inline` until something says otherwise; and a
 * vertical margin on an inline box does nothing. Measured on the rendered
 * page afterwards: 0px between rows, whatever number the class named.
 *
 * That is the part worth writing down. The class is right there in the diff
 * and reads as spacing, so review does not catch it, and a screenshot does
 * not either unless somebody measures. A flex column blockifies its children,
 * so `gap` is a gap whatever the child is.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = fs.readFileSync(
    path.join(process.cwd(), "module-sources/forum/pages/public/page.tsx"),
    "utf8",
);

describe("the forum's topic list", () => {
    it("draws each topic as a link around a card", () => {
        // The shape the rule is about: if this stops being a link, the rule
        // below stops mattering and this test should be deleted with it.
        expect(PAGE).toMatch(/<Link key=\{topic\.id\}/);
    });

    it("spaces the rows with a gap, which works on an inline child", () => {
        const container = PAGE.match(/className="lg:col-span-4[^"]*"/)?.[0] ?? "";
        expect(container).toMatch(/\bflex\b/);
        expect(container).toMatch(/\bgap-\d/);
        expect(container).not.toMatch(/\bspace-y-\d/);
    });
});
