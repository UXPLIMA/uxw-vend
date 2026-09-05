import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Every control on a screen says what it is, and every label names something.
 *
 * Two failures, neither of which shows up in a screenshot:
 *
 *   - A button whose whole content is an icon, an arrow glyph or nothing at
 *     all is announced as "button" and nothing else. Eight of them: the
 *     reorder arrows on the navbar and homepage-widget settings, the cart's
 *     quantity steppers, and the carousel dots on the slider widget and the
 *     product page.
 *   - A `<Label htmlFor="x">` with no `id="x"` on the same screen names
 *     nothing and does not focus anything when clicked. Ten of them, and all
 *     ten sat beside a control that cannot take an `htmlFor` the naive way: a
 *     Radix `<Select>`, whose id belongs on `<SelectTrigger>`; a Quill editor,
 *     which owns its own contenteditable; and `<FileUpload>`, whose real
 *     control is a button and whose file input is hidden.
 *
 * The label half is checked in both directions. A dangling `htmlFor` is the
 * bug that was there; a duplicate `id` is the bug a careless fix introduces,
 * since two controls answering to one label is no better than none.
 */

const ROOT = process.cwd();
const DIRS = ["src/app", "src/core", "module-sources"];

function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith(".tsx")) out.push(full);
    }
    return out;
}

const FILES = DIRS.flatMap((d) => walk(path.join(ROOT, d)));
const rel = (f: string) => path.relative(ROOT, f);

/** The attributes of the JSX element opening at `start`, and where it ends. */
function openTag(source: string, start: number): { attrs: string; end: number } {
    let i = start;
    let depth = 0;
    while (i < source.length) {
        const c = source[i];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) break;
        i++;
    }
    return { attrs: source.slice(start, i), end: i };
}

const INTERACTIVE = ["a", "Link", "button", "Button"] as const;

/**
 * Components that take their name from the caller. Each renders one of the
 * tags above and spreads the props it is given, so the name is the caller's
 * to supply and every call site is checked instead.
 */
const FORWARDS_ITS_NAME: Record<string, string> = {
    "src/core/components/ui/button.tsx":
        "The button primitive. It spreads props onto the element, so aria-label reaches it from whoever renders it.",
};

interface Unnamed {
    file: string;
    line: number;
    tag: string;
}

function unnamedControls(): Unnamed[] {
    const found: Unnamed[] = [];
    for (const file of FILES) {
        if (FORWARDS_ITS_NAME[rel(file)]) continue;
        const source = fs.readFileSync(file, "utf8");
        for (const tag of INTERACTIVE) {
            for (const m of source.matchAll(new RegExp(`<(${tag})\\b`, "g"))) {
                const at = m.index! + m[0].length;
                const { attrs, end } = openTag(source, at);
                let named = /aria-label|aria-labelledby|title=/.test(attrs);
                if (!named && source[end - 1] !== "/") {
                    const after = source.slice(end + 1, end + 2500);
                    const close = after.indexOf(`</${tag}>`);
                    const body = close === -1 ? after : after.slice(0, close);
                    const text = body.replace(/<[^>]*>/g, "").replace(/\s/g, "");
                    // A nested alt or sr-only span names the control too; so
                    // does any word of visible text, which is the usual case.
                    named = /aria-label|title=|sr-only|alt=/.test(body) || /\w/.test(text);
                }
                if (named) continue;
                found.push({ file: rel(file), line: source.slice(0, m.index!).split("\n").length, tag });
            }
        }
    }
    return found;
}

describe("a control with no words in it", () => {
    it("is found by the scan at all", () => {
        // The arrow-glyph buttons are the shape this was written for: `▲` is
        // not a word, so nothing announces them without an aria-label.
        const navbar = fs.readFileSync(
            path.join(ROOT, "src/app/[locale]/(admin)/admin/settings/navbar/page.tsx"),
            "utf8",
        );
        expect(navbar).toContain('aria-label={t("common_moveUp"');
        expect(navbar).toContain('<span aria-hidden="true">▲</span>');
    });

    it("says what it is", () => {
        expect(unnamedControls().map((u) => `${u.file}:${u.line} <${u.tag}>`)).toEqual([]);
    });

    it("every name-forwarding primitive listed still exists and still forwards", () => {
        for (const [file, reason] of Object.entries(FORWARDS_ITS_NAME)) {
            const full = path.join(ROOT, file);
            expect(fs.existsSync(full), `${file}: ${reason}`).toBe(true);
            expect(fs.readFileSync(full, "utf8"), file).toContain("...props");
        }
    });
});

describe("a label", () => {
    /** Every `id="..."` literal in a file, including template ids. */
    function idsIn(source: string): string[] {
        return [
            ...Array.from(source.matchAll(/\bid="([^"]+)"/g), (m) => m[1]),
            ...Array.from(source.matchAll(/\bid=\{`([^`]+)`\}/g), (m) => m[1]),
        ];
    }

    function htmlForIn(source: string): { value: string; line: number }[] {
        return [
            ...Array.from(source.matchAll(/htmlFor="([^"]+)"/g), (m) => ({
                value: m[1],
                line: source.slice(0, m.index!).split("\n").length,
            })),
            ...Array.from(source.matchAll(/htmlFor=\{`([^`]+)`\}/g), (m) => ({
                value: m[1],
                line: source.slice(0, m.index!).split("\n").length,
            })),
        ];
    }

    it("names something on the same screen", () => {
        const dangling: string[] = [];
        for (const file of FILES) {
            const source = fs.readFileSync(file, "utf8");
            const ids = new Set(idsIn(source));
            for (const { value, line } of htmlForIn(source)) {
                // A component's own label takes its target from a prop, so
                // there is nothing in this file to match it against.
                if (source.includes(`htmlFor={${value}}`)) continue;
                if (!ids.has(value)) dangling.push(`${rel(file)}:${line}  htmlFor="${value}"`);
            }
        }
        expect(dangling).toEqual([]);
    });

    it("names one thing, not two", () => {
        const duplicated: string[] = [];
        for (const file of FILES) {
            const source = fs.readFileSync(file, "utf8");
            const targets = new Set(htmlForIn(source).map((h) => h.value));
            const counts = new Map<string, number>();
            for (const id of idsIn(source)) counts.set(id, (counts.get(id) ?? 0) + 1);
            for (const [id, n] of counts) {
                if (n > 1 && targets.has(id)) duplicated.push(`${rel(file)}  id="${id}" x${n}`);
            }
        }
        expect(duplicated).toEqual([]);
    });
});

describe("the three controls a label could not reach", () => {
    it("a Radix select is named through its trigger", () => {
        for (const file of [
            "module-sources/blog/pages/admin/articles/new/page.tsx",
            "module-sources/blog/pages/admin/articles/[id]/edit/page.tsx",
        ]) {
            const source = fs.readFileSync(path.join(ROOT, file), "utf8");
            expect(source, file).toContain('<SelectTrigger id="status">');
            expect(source, file).toContain('<SelectTrigger id="category">');
        }
    });

    it("the rich text editor names its group, since Quill owns the field", () => {
        const editor = fs.readFileSync(path.join(ROOT, "src/core/components/ui/rich-text-editor.tsx"), "utf8");
        expect(editor).toContain("labelledBy");
        expect(editor).toContain('role={labelledBy ? "group" : undefined}');
        expect(editor).toContain("aria-labelledby={labelledBy}");
        for (const file of [
            "module-sources/blog/pages/admin/articles/new/page.tsx",
            "module-sources/store/pages/admin/products/new/page.tsx",
        ]) {
            expect(fs.readFileSync(path.join(ROOT, file), "utf8"), file).toContain("labelledBy=");
        }
    });

    it("the file picker puts its id on the button, not the hidden input", () => {
        const upload = fs.readFileSync(path.join(ROOT, "src/core/components/ui/file-upload.tsx"), "utf8");
        expect(upload).toContain("<Label htmlFor={id}>{label}</Label>");
        // The file input stays hidden and unaddressed: it is not the control
        // a person clicks, so pointing a label at it would name nothing.
        const hidden = upload.slice(upload.indexOf('type="file"'));
        expect(hidden).not.toContain("id={id}");
    });

    it("the picker's preview image is described in the reader's language", () => {
        const upload = fs.readFileSync(path.join(ROOT, "src/core/components/ui/file-upload.tsx"), "utf8");
        expect(upload).toContain('alt={t("preview")}');
        for (const locale of ["en", "tr"]) {
            const messages = JSON.parse(fs.readFileSync(path.join(ROOT, `messages-core/${locale}.json`), "utf8"));
            expect(messages.common.preview, locale).toBeTruthy();
            expect(messages.admin.common_moveUp, locale).toContain("{label}");
            expect(messages.admin.common_moveDown, locale).toContain("{label}");
        }
    });
});
