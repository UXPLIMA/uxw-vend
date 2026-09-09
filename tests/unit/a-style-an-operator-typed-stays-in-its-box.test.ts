/**
 * Letting an operator style a role's name, in their own CSS.
 *
 * A community wants its founder in gold and its moderators in blue, with a
 * gradient and a glow that no colour picker will ever produce. So they write
 * CSS, and it is rendered into the page beside every name that role wears.
 *
 * The approved list of things to block was `expression`, `url` and `@import`,
 * and each of those is real. What that list does not cover is the attack that
 * needs no function at all.
 *
 * The declarations go inside a rule that this site writes: `.role-founder {
 * ... }`. A closing brace in the middle of what an operator typed ends that
 * rule early and starts a new one, and the new one is theirs: `} body { }`
 * styles the whole page. An overlay the size of the viewport, painted over the
 * real page, is a login form that is not ours - and it arrives as CSS, which
 * nobody reads as code.
 *
 * The same goes for `<`, because the block is written into a `<style>` tag and
 * `</style>` ends it. What follows is HTML.
 *
 * And the blocklist is only worth what its spelling is worth. CSS lets an
 * identifier be escaped a character at a time - `\75 rl(...)` is `url(...)` -
 * and comments split a keyword in two. So the text is folded before it is
 * judged, not after.
 */
import { describe, it, expect } from "vitest";
import { safeRoleCss } from "@/core/lib/role-css";

describe("what an operator may write", () => {
    it("takes plain declarations", () => {
        expect(safeRoleCss("color: gold; font-weight: 700;")).toBe("color: gold; font-weight: 700;");
    });

    it("takes a gradient, which is the reason they wanted CSS", () => {
        const gradient = "background: linear-gradient(90deg, #f00, #00f); -webkit-background-clip: text;";
        expect(safeRoleCss(gradient)).toBe(gradient);
    });

    it("takes an animation and a shadow", () => {
        const glow = "text-shadow: 0 0 4px #ff0; animation: pulse 2s infinite;";
        expect(safeRoleCss(glow)).toBe(glow);
    });
});

describe("breaking out of the rule", () => {
    it("is refused for a closing brace", () => {
        // The attack the approved list does not mention: end our rule, start
        // theirs, and style the whole page.
        expect(safeRoleCss("color: red } body { display: none")).toBeNull();
    });

    it("is refused for an opening brace too", () => {
        expect(safeRoleCss("color: red; a { color: blue")).toBeNull();
    });

    it("is refused for anything that could close the style tag", () => {
        expect(safeRoleCss("color: red </style><script>alert(1)</script>")).toBeNull();
        expect(safeRoleCss("color: red <")).toBeNull();
    });
});

describe("what the folding removes but the page still gets", () => {
    /*
     * The first version of this file folded the text to judge it - comments
     * stripped, escapes resolved - and then stored what was typed. Anything
     * the folding removed was invisible to the judge and present in what
     * rendered, which is the whole bug in one sentence.
     *
     * An HTML parser does not know what a CSS comment is. Inside a `<style>`
     * element it scans for `</style` and ends the element there, whatever CSS
     * thinks is a comment. So a closing tag hidden in a comment passed the
     * check and closed the tag anyway.
     */
    it("refuses a closing tag hidden in a comment", () => {
        expect(safeRoleCss("color: red /* </style><script>alert(1)</script> */")).toBeNull();
    });

    it("refuses a brace hidden in a comment", () => {
        expect(safeRoleCss("color: red /* } body { display:none */")).toBeNull();
    });

    it("refuses an unclosed comment carrying one", () => {
        // A browser reading an unterminated comment swallows the rest of the
        // sheet, and the tag still closes where the parser finds it.
        expect(safeRoleCss("color: red /* </style>")).toBeNull();
    });

    it("still takes a comment that is only a comment", () => {
        // Refusing every comment would be refusing something operators write.
        expect(safeRoleCss("color: gold; /* the founder */")).toBe("color: gold; /* the founder */");
    });
});

describe("the functions and rules that were named", () => {
    it("refuses a fetch of anything", () => {
        expect(safeRoleCss("background: url(https://evil.example/x.png)")).toBeNull();
    });

    it("refuses another stylesheet", () => {
        expect(safeRoleCss("@import url('https://evil.example/x.css'); color: red")).toBeNull();
    });

    it("refuses anything that ran as script in a browser somewhere", () => {
        for (const attempt of [
            "width: expression(alert(1))",
            "behavior: url(#default#time2)",
            "-moz-binding: url(https://evil.example/x.xml#x)",
        ]) {
            expect(safeRoleCss(attempt), attempt).toBeNull();
        }
    });

    it("refuses every at-rule, not only the one that was named", () => {
        // `@import` was the one anybody thought of. `@media` and `@supports`
        // are harmless on their own but they carry a block, which is a brace.
        expect(safeRoleCss("@media print { color: red }")).toBeNull();
        expect(safeRoleCss("@charset 'utf-8'; color: red")).toBeNull();
    });
});

describe("a blocklist is worth what its spelling is worth", () => {
    it("sees through a case change", () => {
        expect(safeRoleCss("background: URL(https://evil.example/x.png)")).toBeNull();
        expect(safeRoleCss("width: ExPrEsSiOn(alert(1))")).toBeNull();
    });

    it("sees through a CSS escape", () => {
        // `\75` is `u`. A browser reads this as `url(`.
        expect(safeRoleCss("background: \\75 rl(https://evil.example/x.png)")).toBeNull();
        expect(safeRoleCss("background: \\000075rl(https://evil.example/x.png)")).toBeNull();
    });

    it("sees through a comment splitting a keyword", () => {
        expect(safeRoleCss("width: expr/**/ession(alert(1))")).toBeNull();
        expect(safeRoleCss("@im/**/port 'x.css'")).toBeNull();
    });

    it("sees through a backslash that means nothing", () => {
        // `\u` is just `u` to a CSS parser.
        expect(safeRoleCss("background: \\url(https://evil.example/x.png)")).toBeNull();
    });
});

describe("what is not CSS at all", () => {
    it("refuses nothing, which is a role with no style", () => {
        expect(safeRoleCss("")).toBeNull();
        expect(safeRoleCss("   ")).toBeNull();
    });

    it("refuses more than anybody types by hand", () => {
        expect(safeRoleCss("color: red;".repeat(500))).toBeNull();
    });
});
