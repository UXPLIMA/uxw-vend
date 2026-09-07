import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Every `dangerouslySetInnerHTML` in this tree is one somebody argued for.
 *
 * There are seven, and each is safe for a different reason: one sanitises with
 * DOMPurify, two escape `<` so a value cannot close the `<script>` they sit
 * in, one is a static literal with nothing interpolated, and one builds CSS
 * from an allowlist of token names and hex colours. None of that is visible
 * from the call site, so an eighth written by someone who has not read all
 * five would look exactly like the seven.
 *
 * The surface is worth a gate rather than a habit. A dependency advisory
 * against the rich-text editor - Quill, XSS via its HTML export - was checked
 * on 2026-09-07 and does not reach the product precisely because the one place
 * that renders editor output sanitises it. That is the whole defence, and it
 * is one line.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * Why each site is allowed to write raw HTML. The key is the file; the value
 * is the argument. A site with no entry fails, and so does an entry whose file
 * no longer writes raw HTML.
 */
const ARGUED_FOR: Record<string, string> = {
    "src/core/components/ui/rich-content.tsx":
        "the one renderer of editor output, and it passes the html through DOMPurify.sanitize",
    "src/app/[locale]/layout.tsx":
        "three sites: a static literal that reads localStorage, the organization JSON-LD which escapes `<`, and theme CSS built from an allowlist of token names and hex colours",
    "module-sources/blog/pages/[...params]/page.tsx":
        "article JSON-LD from buildArticleJsonLd, which escapes `<` so a title cannot close the script tag",
};

function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Files that write raw HTML, excluding the installed runtime copy of a module. */
function rawHtmlFiles(): string[] {
    const found = new Set<string>();
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                // `src/modules` is the gitignored install state of what lives
                // in `module-sources`; counting it reports every module twice
                // and lets a fix nobody commits turn this green.
                if (["generated", "node_modules", "modules"].includes(entry.name)) continue;
                walk(full);
                continue;
            }
            if (!entry.name.endsWith(".tsx") && !entry.name.endsWith(".ts")) continue;
            // Comments first. `seo.ts` documents the tag its builders feed,
            // and `CustomCssInjector` explains why it does *not* use this;
            // a gate that reports prose is one people learn to skip.
            const source = withoutComments(fs.readFileSync(full, "utf8"));
            if (/dangerouslySetInnerHTML=\{/.test(source)) {
                found.add(path.relative(ROOT, full));
            }
        }
    };
    walk(path.join(ROOT, "src"));
    walk(path.join(ROOT, "module-sources"));
    return [...found].sort();
}

describe("raw HTML on a page", () => {
    const files = rawHtmlFiles();

    it("is written in a handful of places, so the gate has something to guard", () => {
        expect(files.length).toBeGreaterThan(0);
    });

    it("is written only where somebody wrote down why that is safe", () => {
        const unexplained = files.filter((f) => !(f in ARGUED_FOR));
        expect(
            unexplained,
            "add the file to ARGUED_FOR with the reason its html cannot carry a script",
        ).toEqual([]);
    });

    it("does not carry an argument for a file that stopped writing it", () => {
        const stale = Object.keys(ARGUED_FOR).filter((f) => !files.includes(f));
        expect(stale, "these no longer write raw html; drop them").toEqual([]);
    });

    it("still sanitises the one place editor output is rendered", () => {
        const source = fs.readFileSync(
            path.join(ROOT, "src/core/components/ui/rich-content.tsx"),
            "utf8",
        );
        // Not "DOMPurify is imported" - that it is the value being written.
        expect(source).toMatch(/dangerouslySetInnerHTML=\{\{\s*__html:\s*DOMPurify\.sanitize\(/);
    });

    it("still escapes `<` in both JSON-LD builders", () => {
        const seo = fs.readFileSync(path.join(ROOT, "src/core/lib/seo.ts"), "utf8");
        const escapes = [...seo.matchAll(/JSON\.stringify\(ld\)\.replace\(\/<\/g, "\\\\u003c"\)/g)];
        expect(
            escapes.length,
            "a JSON-LD string that does not escape `<` lets a title close its own script tag",
        ).toBe(2);
    });
});
