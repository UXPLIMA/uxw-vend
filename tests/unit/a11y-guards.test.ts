import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * An icon is not a name.
 *
 * A `<button>` or `<Link>` whose entire body is a lucide icon reaches a screen
 * reader as "button", with nothing to say what it does. The auth pages' home
 * link, the breadcrumb's home crumb, the store's gallery arrows and quantity
 * stepper, the cart's two "remove this code" buttons, the slider arrows and
 * every close button in the product shipped that way.
 *
 * The rule: an icon-only control carries `aria-label` (or `aria-labelledby`,
 * or `title`). A control with any text of its own is already named and is not
 * matched here.
 */

const root = path.resolve(import.meta.dirname, "../..");
const SCANNED = ["src/app", "src/core/components", "module-sources"];

function tsxFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) tsxFiles(full, out);
        else if (entry.name.endsWith(".tsx")) out.push(full);
    }
    return out;
}

/**
 * Index of the `>` closing the tag that starts at `start`, skipping the ones
 * inside a JSX expression (`onClick={(e) => ...}`) or a string.
 */
function tagEnd(source: string, start: number): number {
    let depth = 0;
    let quote: string | null = null;
    for (let i = start; i < source.length; i++) {
        const c = source[i];
        if (quote) {
            if (c === quote && source[i - 1] !== "\\") quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) return i;
    }
    return -1;
}

function iconOnlyControlsWithoutName(file: string): string[] {
    const source = fs.readFileSync(file, "utf8");
    const found: string[] = [];

    for (const tag of ["Link", "button", "a"]) {
        const open = `<${tag}`;
        let i = source.indexOf(open);
        while (i !== -1) {
            if (/[\s>]/.test(source[i + open.length] ?? "")) {
                const end = tagEnd(source, i);
                const close = source.indexOf(`</${tag}>`, end);
                // A long body is markup, not a bare icon.
                if (end !== -1 && close !== -1 && close - end < 400) {
                    const attrs = source.slice(i + open.length, end);
                    const inner = source
                        .slice(end + 1, close)
                        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
                        .trim();
                    const named = /aria-label|aria-labelledby|title=/.test(attrs);
                    // Exactly one self-closing capitalised element and nothing else.
                    const iconOnly = /^<[A-Z][A-Za-z0-9]*\b[^>]*\/>$/.test(inner);
                    if (iconOnly && !named) {
                        found.push(
                            `${path.relative(root, file)}: <${tag}> wrapping ${inner.replace(/\s+/g, " ").slice(0, 60)}`,
                        );
                    }
                }
            }
            i = source.indexOf(open, i + 1);
        }
    }

    return found;
}

describe("icon-only controls", () => {
    const files = SCANNED.flatMap((dir) => tsxFiles(path.join(root, dir)));

    it("scans the app, the shared components and every module", () => {
        expect(files.length).toBeGreaterThan(200);
    });

    it("all carry an accessible name", () => {
        const violations = files.flatMap(iconOnlyControlsWithoutName);
        expect(violations).toEqual([]);
    });
});

describe("the homepage", () => {
    /**
     * Its content is a stack of module sections, none of which is the page's
     * own title, so the document outline used to start at h2 with nothing
     * naming the page.
     */
    it("names itself with an h1", () => {
        const source = fs.readFileSync(path.join(root, "src/app/[locale]/page.tsx"), "utf8");
        expect(source).toMatch(/<h1[\s>]/);
    });
});
