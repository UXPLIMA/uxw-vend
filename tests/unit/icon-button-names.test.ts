/**
 * A button that is only an icon has no name at all.
 *
 * Sixty-one controls across thirty-eight screens rendered nothing but a
 * Lucide icon: the delete and edit buttons on every admin list, the back
 * arrow at the top of a dozen detail pages, every pagination arrow, the
 * copy-to-clipboard buttons on the API key, media, gift code and referral
 * screens, the close button in four dialogs, the reply-send button on the
 * profile messages tab. An icon is a `<svg>` with no text in it, so a screen
 * reader read all sixty-one as "button", and a voice-control user had
 * nothing to say to click one.
 *
 * `aria-label` is the fix, taking its text from core's `common` namespace,
 * which already carried delete, edit, back, close, remove, previous and next
 * for exactly this vocabulary.
 *
 * The rule this gate applies: a `<button>`, `<Button>`, `<a>` or `<Link>`
 * that renders no text needs `aria-label`, `aria-labelledby` or `title`. It
 * decides "renders no text" the way a browser would, by looking at what
 * survives once the child tags are stripped:
 *
 *   - a `{value}` expression with no JSX in it renders that value, so the
 *     control is named (`<button>{count}</button>`);
 *   - a `{cond ? <A/> : <B/>}` expression renders only icons, so it is not;
 *   - unless something is left inside it once the tags go - a call, a string
 *     literal, or a nested `{...}` child - which is text again.
 *
 * A companion to `form-control-names.test.ts`, which covers inputs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "../..");
const SCANNED = ["src/app", "src/core/components", "module-sources"];
const TAGS = ["button", "Button", "a", "Link"];

function tsxFiles(dir: string, out: string[] = []): string[] {
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (entry === "node_modules") continue;
            tsxFiles(full, out);
        } else if (entry.endsWith(".tsx")) out.push(full);
    }
    return out;
}

/** Index of the `>` that closes the tag opening at `start`, skipping braces and strings. */
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

/** The top-level `{...}` spans of a fragment. */
function braceSpans(s: string): [number, number][] {
    const spans: [number, number][] = [];
    let depth = 0;
    let start = -1;
    let quote: string | null = null;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (quote) {
            if (c === quote && s[i - 1] !== "\\") quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") {
            if (depth > 0) quote = c;
            continue;
        }
        if (c === "{") {
            if (depth === 0) start = i;
            depth++;
        } else if (c === "}") {
            depth--;
            if (depth === 0) spans.push([start, i + 1]);
        }
    }
    return spans;
}

/** Everything outside a tag: `<b>hi {x}</b>` becomes `hi {x}`. */
function stripTags(s: string): string {
    let out = "";
    for (let i = 0; i < s.length; i++) {
        if (s[i] === "<") {
            const e = tagEnd(s, i);
            if (e === -1) break;
            i = e;
            continue;
        }
        out += s[i];
    }
    return out;
}

export function rendersText(inner: string): boolean {
    const spans = braceSpans(inner);
    for (const [a, b] of spans) {
        const expr = inner.slice(a, b);
        if (!/<[A-Za-z]/.test(expr)) return true;
        const bare = stripTags(expr);
        if (/[A-Za-z_$][\w$]*\s*\(/.test(bare)) return true;
        if (/["'`][^"'`]*\S[^"'`]*["'`]/.test(bare)) return true;
        if (bare.slice(1).includes("{")) return true;
    }
    let rest = "";
    let last = 0;
    for (const [a, b] of spans) {
        rest += inner.slice(last, a);
        last = b;
    }
    rest += inner.slice(last);
    return /\S/.test(stripTags(rest));
}

interface Offender {
    file: string;
    line: number;
    tag: string;
    snippet: string;
}

function unnamedIconControls(source: string, file: string): Offender[] {
    const out: Offender[] = [];
    for (const tag of TAGS) {
        const re = new RegExp(`<${tag}\\b`, "g");
        let m: RegExpExecArray | null;
        while ((m = re.exec(source))) {
            const end = tagEnd(source, m.index);
            if (end === -1) continue;
            if (source[end - 1] === "/") continue;
            const open = source.slice(m.index, end + 1);
            if (/aria-label|aria-labelledby|title=/.test(open)) continue;
            const closeTok = `</${tag}>`;
            const openTok = `<${tag}`;
            let level = 1;
            let pos = end + 1;
            let close = -1;
            while (level > 0) {
                const c = source.indexOf(closeTok, pos);
                const o = source.indexOf(openTok, pos);
                if (c === -1) break;
                if (o !== -1 && o < c) {
                    level++;
                    pos = o + openTok.length;
                } else {
                    level--;
                    pos = c + closeTok.length;
                    close = c;
                }
            }
            if (close === -1) continue;
            const inner = source.slice(end + 1, close);
            if (rendersText(inner)) continue;
            // No icon either: an empty element is a layout artefact, not a control.
            if (!/<[A-Z]/.test(inner)) continue;
            // A wrapper whose only child is a Button: the Button carries the name.
            if (tag === "Link" && /^\s*<Button\b/.test(inner)) continue;
            out.push({
                file,
                line: source.slice(0, m.index).split("\n").length,
                tag,
                snippet: inner.replace(/\s+/g, " ").trim().slice(0, 70),
            });
        }
    }
    return out;
}

function scanned(): { rel: string; source: string }[] {
    const files: { rel: string; source: string }[] = [];
    for (const dir of SCANNED) {
        for (const full of tsxFiles(join(ROOT, dir))) {
            files.push({
                rel: relative(ROOT, full).replace(/\\/g, "/"),
                source: readFileSync(full, "utf-8"),
            });
        }
    }
    return files;
}

describe("icon-only controls carry an accessible name", () => {
    it("names every button and link that renders no text", () => {
        const offenders: string[] = [];
        for (const { rel, source } of scanned()) {
            for (const o of unnamedIconControls(source, rel)) {
                offenders.push(`${o.file}:${o.line} <${o.tag}> ${o.snippet}`);
            }
        }
        expect(
            offenders,
            `Add aria-label={commonT("delete")} or the matching common key:\n${offenders.join("\n")}`,
        ).toEqual([]);
    });

    it("has the vocabulary these labels draw on", async () => {
        const en = JSON.parse(readFileSync(join(ROOT, "messages-core/en.json"), "utf-8"));
        const tr = JSON.parse(readFileSync(join(ROOT, "messages-core/tr.json"), "utf-8"));
        for (const key of ["delete", "edit", "back", "close", "remove", "copy", "send", "previousPage", "nextPage"]) {
            expect(en.common, `messages-core/en.json common.${key}`).toHaveProperty(key);
            expect(tr.common, `messages-core/tr.json common.${key}`).toHaveProperty(key);
        }
    });
});

describe("rendersText", () => {
    it("treats a value expression as a name", () => {
        expect(rendersText("{count}")).toBe(true);
        expect(rendersText("{children}")).toBe(true);
        expect(rendersText('{t("crud_delete")}')).toBe(true);
    });

    it("treats a JSX-only expression as an icon", () => {
        expect(rendersText("{copied ? <Check /> : <Copy />}")).toBe(false);
        expect(rendersText('<Trash2 className="w-3 h-3" />')).toBe(false);
    });

    it("finds the text nested inside a JSX expression", () => {
        expect(rendersText('{saving ? <><Loader2 /> {t("adm_saving")}</> : <Save />}')).toBe(true);
        expect(rendersText("{saving ? <><Loader2 /> {savingLabel}</> : <Save />}")).toBe(true);
    });

    it("finds a plain text node next to an icon", () => {
        expect(rendersText('<Trash2 className="w-3 h-3" /> Delete')).toBe(true);
        expect(rendersText("<span>Delete</span>")).toBe(true);
    });
});
