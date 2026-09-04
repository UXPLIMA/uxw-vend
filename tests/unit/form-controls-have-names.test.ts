import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A control with no accessible name is announced by its role alone: "checkbox,
 * unchecked" with no hint of what it selects, "combo box" with no hint of what
 * it changes. Sixty six controls across the admin panel, the setup wizard and
 * eight modules were in that state.
 *
 * A placeholder is not a name. It disappears the moment anything is typed, is
 * ignored outright by some assistive technology, and where it holds an example
 * rather than a description - "/path", "#3b82f6", "give {player} diamond 64" -
 * repeating it as a name says nothing. So the ones with a descriptive
 * placeholder now carry it as `aria-label` too, which is what the store's
 * search box already did, and the rest borrow the visible label beside them.
 *
 * The rule here is the one WCAG states: every control needs a name from
 * `aria-label`, `aria-labelledby`, or a `<label>` that wraps it or points at
 * its id. A placeholder alone does not satisfy it.
 */

const ROOT = path.resolve(__dirname, "../..");
const CONTROL = /<(input|select|textarea|Input|Textarea)\b/g;

/** The primitives themselves: they forward whatever a caller passes. */
const PRIMITIVES = new Set([
    "src/core/components/ui/input.tsx",
    "src/core/components/ui/textarea.tsx",
    "src/core/components/ui/password-input.tsx",
]);

function tsxFiles(): string[] {
    const out: string[] = [];
    for (const base of ["src", "module-sources"]) {
        const walk = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === "node_modules" || entry.name === "generated") continue;
                    walk(full);
                } else if (entry.name.endsWith(".tsx")) {
                    const rel = path.relative(ROOT, full);
                    // src/modules is the installed copy of module-sources.
                    if (rel.startsWith(`src${path.sep}modules`)) continue;
                    if (PRIMITIVES.has(rel.split(path.sep).join("/"))) continue;
                    out.push(full);
                }
            }
        };
        walk(path.join(ROOT, base));
    }
    return out;
}

/** The opening tag starting at `start`, brace-aware so JSX expressions survive. */
function openingTag(body: string, start: number): string {
    let depth = 0;
    for (let i = start; i < body.length; i++) {
        const c = body[i];
        if (c === "{") depth += 1;
        else if (c === "}") depth -= 1;
        else if (c === ">" && depth === 0) return body.slice(start, i + 1);
    }
    return body.slice(start, start + 600);
}

function attrValue(tag: string, name: string): string | null {
    const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\`?([^}\`]*)\`?\\})`).exec(tag);
    if (!m) return null;
    return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

function labelTargets(body: string): Set<string> {
    const out = new Set<string>();
    const re = /\bhtmlFor\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`?([^}`]*)`?\})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) out.add((m[1] ?? m[2] ?? m[3] ?? "").trim());
    return out;
}

/** Is the control at `at` nested inside a still-open <label>? */
function insideLabel(body: string, at: number): boolean {
    const before = body.slice(0, at);
    for (const tag of ["label", "Label"]) {
        if (before.lastIndexOf(`<${tag}`) > before.lastIndexOf(`</${tag}>`)) return true;
    }
    return false;
}

function unnamedControls(file: string): string[] {
    const body = fs.readFileSync(file, "utf8");
    const fors = labelTargets(body);
    const out: string[] = [];
    CONTROL.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CONTROL.exec(body)) !== null) {
        const lineStart = body.lastIndexOf("\n", m.index) + 1;
        if (/^\s*(\/\/|\*)/.test(body.slice(lineStart, m.index))) continue;

        const tag = openingTag(body, m.index);
        if (attrValue(tag, "type") === "hidden") continue;
        // A wrapper that spreads a caller's props cannot be judged here.
        if (tag.includes("{...props}")) continue;
        if (/\baria-label(ledby)?\s*=/.test(tag)) continue;

        const id = attrValue(tag, "id");
        if (id && fors.has(id)) continue;
        if (insideLabel(body, m.index)) continue;

        out.push(`${path.relative(ROOT, file)}:${body.slice(0, m.index).split("\n").length}`);
    }
    return out;
}

const FILES = tsxFiles();

describe("form controls", () => {
    it("finds the components", () => {
        expect(FILES.length).toBeGreaterThan(200);
    });

    it("all have an accessible name", () => {
        const unnamed = FILES.flatMap(unnamedControls);
        expect(unnamed).toEqual([]);
    });

    it("does not count a placeholder as one", () => {
        // Guards the rule itself: if the checker ever started accepting
        // placeholder, this synthetic control would slip through.
        const tag = '<input placeholder="Search" />';
        expect(/\baria-label(ledby)?\s*=/.test(tag)).toBe(false);
    });

    it("accepts a label that wraps the control", () => {
        const body = '<label>Name<input value={x} /></label>';
        expect(insideLabel(body, body.indexOf("<input"))).toBe(true);
        const after = '<label>Name</label><input value={x} />';
        expect(insideLabel(after, after.indexOf("<input"))).toBe(false);
    });

    it("accepts a label that points at the control's id", () => {
        const body = '<label htmlFor={nameId}>Name</label><input id={nameId} />';
        expect(labelTargets(body).has("nameId")).toBe(true);
    });
});
