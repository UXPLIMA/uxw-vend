/**
 * A hover state that is the resting state.
 *
 * `className="bg-muted hover:bg-muted"` compiles, passes review and does
 * nothing: the pointer crosses the control and not a pixel moves. It reads to
 * a visitor as a dead element, which on a button is worse than having no hover
 * at all - the styling promises interactivity and then withholds the feedback.
 *
 * Found while fixing the feedback buttons on a help article, which asked for
 * `bg-success/10 hover:bg-success/10`. The same typo had happened six more
 * times across the blog, the suggestion board and the navbar.
 *
 * The check is deliberately exact. `bg-primary` beside `hover:bg-primary/90`
 * is a real hover and a substring match would flag it, so the tokens are
 * compared whole.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOKEN = /(?<![\w:/-])(hover:)?bg-([a-zA-Z0-9/[\]._-]+)/g;

function sources(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "generated") continue;
        const full = path.join(dir, entry.name);
        // `src/modules` is runtime install state, a copy of module-sources.
        // Reporting a path there would send somebody to fix the copy.
        if (full === path.join(ROOT, "src", "modules")) continue;
        if (entry.isDirectory()) sources(full, out);
        else if (/\.tsx$/.test(entry.name)) out.push(full);
    }
    return out;
}

const files = [...sources(path.join(ROOT, "src")), ...sources(path.join(ROOT, "module-sources"))];

describe("a hover state", () => {
    it("has files to read", () => {
        expect(files.length).toBeGreaterThan(200);
    });

    it("is never the same colour as the resting state", () => {
        const dead: string[] = [];
        for (const file of files) {
            const source = fs.readFileSync(file, "utf8");
            // One string literal at a time, not one line.
            //
            // A ternary puts the resting colour in one branch and the hover in
            // the other - `active ? "bg-muted" : "hover:bg-muted"` - and they
            // never apply together, so comparing per line called three correct
            // components broken. A class list is a single string; that is the
            // unit where two tokens really do land on the same element.
            for (const literal of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
                const text = literal[1] ?? literal[2] ?? literal[3] ?? "";
                // Inside a template, an interpolation is its own branch too.
                for (const chunk of text.split(/\$\{[^}]*\}/)) {
                    const base = new Set<string>();
                    const hover = new Set<string>();
                    for (const m of chunk.matchAll(TOKEN)) {
                        (m[1] ? hover : base).add(m[2]);
                    }
                    for (const token of base) {
                        if (hover.has(token)) {
                            const line = source.slice(0, literal.index).split("\n").length;
                            dead.push(`${path.relative(ROOT, file)}:${line}  bg-${token} and hover:bg-${token}`);
                        }
                    }
                }
            }
        }
        expect(
            dead,
            "A hover that repeats the resting colour is a control that looks dead under the pointer:\n" +
            dead.join("\n"),
        ).toEqual([]);
    });
});
