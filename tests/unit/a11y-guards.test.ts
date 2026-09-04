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

/**
 * A click handler on a plain element is a control only a mouse can reach.
 *
 * The store's breadcrumb put one on a `<span>`, so a visitor navigating by
 * keyboard could not go back up a category; the setup wizard put one on the
 * `<div>` wrapping each theme card, which made choosing a theme - a step every
 * install goes through - impossible without a pointer.
 *
 * The exception is a modal backdrop: a full-screen sheet whose click closes
 * the dialog. It is decoration, the dialog itself carries the keyboard path
 * out, and it is only exempt when it is hidden from assistive tech.
 */
const NON_INTERACTIVE = ["div", "span", "li", "tr", "td", "p", "section", "article", "header", "h1", "h2", "h3", "h4", "ul", "label"];

function mouseOnlyControls(file: string): string[] {
    const source = fs.readFileSync(file, "utf8");
    const found: string[] = [];

    for (const tag of NON_INTERACTIVE) {
        const open = `<${tag}`;
        let i = source.indexOf(open);
        while (i !== -1) {
            if (/[\s>]/.test(source[i + open.length] ?? "")) {
                const end = tagEnd(source, i);
                if (end !== -1) {
                    const attrs = source.slice(i + open.length, end);
                    if (/\bonClick\b/.test(attrs)) {
                        // A backdrop hidden from assistive tech is decoration.
                        const backdrop = /aria-hidden="true"/.test(attrs) && /\bfixed\b[^"]*\binset-0\b/.test(attrs);
                        // Anything given a role plus a key handler is already wired.
                        const wired = /\brole=/.test(attrs) && /onKeyDown|onKeyUp|onKeyPress/.test(attrs);
                        if (!backdrop && !wired) {
                            const line = source.slice(0, i).split("\n").length;
                            found.push(`${path.relative(root, file)}:${line} <${tag}> has onClick but no keyboard path`);
                        }
                    }
                }
            }
            i = source.indexOf(open, i + 1);
        }
    }

    return found;
}

describe("click handlers", () => {
    const files = SCANNED.flatMap((dir) => tsxFiles(path.join(root, dir)));

    it("are never the only way to use a control", () => {
        const violations = files.flatMap(mouseOnlyControls);
        expect(violations).toEqual([]);
    });
});

/**
 * A dialog that closes only by clicking its backdrop is a keyboard trap. The
 * media detail panel, the dashboard customizer and the footer language
 * selector were all reachable by keyboard and impossible to leave that way.
 */
describe("dialogs and popovers", () => {
    const CLOSABLE = [
        "src/app/[locale]/(admin)/admin/media/page.tsx",
        "src/app/[locale]/(admin)/admin/modules/ModuleDetailModal.tsx",
        "src/core/components/admin/DashboardCustomizer.tsx",
        "src/core/components/admin/AdminSpotlight.tsx",
        "src/core/components/ui/footer-dropdown.tsx",
        "src/core/components/ui/confirm-dialog.tsx",
        "src/core/components/ui/icon-picker.tsx",
        "module-sources/popups/slots/PopupRenderer.tsx",
    ];

    // Every `role="dialog"` gets Escape from `useModalDialog`, which owns the
    // key along with the Tab trap and returning focus. The footer dropdown is
    // a plain popover with no dialog role and still handles the key itself.
    it("all close on Escape", () => {
        const missing = CLOSABLE.filter((file) => {
            const source = fs.readFileSync(path.join(root, file), "utf8");
            return !source.includes("useModalDialog") && !source.includes('"Escape"');
        });
        expect(missing).toEqual([]);
    });

    it("put the dialog role on the panel, never on the backdrop that closes it", () => {
        for (const file of CLOSABLE) {
            const source = fs.readFileSync(path.join(root, file), "utf8");
            for (const match of source.matchAll(/<div\b([^>]*\brole="dialog"[^>]*)>/g)) {
                expect(match[1], `${file}: the dialog element itself closes on click`).not.toMatch(/\bonClick\b/);
            }
        }
    });
});
