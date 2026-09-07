import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Two functions with one name answer the same question the same way.
 *
 * `escapeHtml` is written twice: once in core's mail sender, once in the
 * store's order confirmation. Core's escapes `& < > " '`. The store's escaped
 * everything but the apostrophe.
 *
 * Nothing is exploitable through that today, because the store puts its values
 * in element text where an apostrophe is a character like any other. It is a
 * trap rather than a hole: the two are indistinguishable at the call site, and
 * the day somebody writes `href='${escapeHtml(url)}'` in the file with the
 * shorter one, the quote that ends the attribute goes straight through.
 *
 * So the rule is about the function rather than about today's call sites: an
 * escaper called `escapeHtml` escapes the five characters that can end a tag,
 * an attribute or an entity. A third copy has to do the same.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = ["src", "module-sources"];

/** What an HTML escaper has to handle to be safe in an attribute as well. */
const MUST_ESCAPE: { char: string; entity: RegExp }[] = [
    { char: "&", entity: /&amp;/ },
    { char: "<", entity: /&lt;/ },
    { char: ">", entity: /&gt;/ },
    { char: '"', entity: /&quot;/ },
    { char: "'", entity: /&#0?39;|&#x27;|&apos;/ },
];

function tsFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === "modules") continue;
            tsFiles(full, out);
        } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
            out.push(full);
        }
    }
    return out;
}

/** The body of a `function escapeHtml(...)`, to its closing brace. */
function bodies(source: string): string[] {
    const out: string[] = [];
    for (const m of source.matchAll(/function\s+escapeHtml\s*\([^)]*\)[^{]*\{/g)) {
        let depth = 0;
        for (let i = m.index + m[0].length - 1; i < source.length; i++) {
            if (source[i] === "{") depth++;
            else if (source[i] === "}" && --depth === 0) {
                out.push(source.slice(m.index, i + 1));
                break;
            }
        }
    }
    return out;
}

describe("an escaper called escapeHtml", () => {
    it("is written somewhere, so this is looking at something", () => {
        const found = SCANNED.flatMap((d) => tsFiles(path.join(ROOT, d)))
            .flatMap((f) => bodies(fs.readFileSync(f, "utf8")));
        expect(found.length).toBeGreaterThan(0);
    });

    it("escapes every character that can end a tag or an attribute", () => {
        const gaps: string[] = [];
        for (const dir of SCANNED) {
            for (const file of tsFiles(path.join(ROOT, dir))) {
                const source = fs.readFileSync(file, "utf8");
                for (const body of bodies(source)) {
                    const missing = MUST_ESCAPE.filter(({ entity }) => !entity.test(body))
                        .map(({ char }) => char);
                    if (missing.length > 0) {
                        gaps.push(`${path.relative(ROOT, file)} leaves ${missing.join(" ")} alone`);
                    }
                }
            }
        }
        expect(
            gaps,
            `two escapers with one name have to behave the same way:\n${gaps.join("\n")}`,
        ).toEqual([]);
    });
});
