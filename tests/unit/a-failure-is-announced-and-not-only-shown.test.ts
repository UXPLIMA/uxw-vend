import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A form that refuses says so out loud.
 *
 * Every screen in the product reports a failed submit the same way: a piece
 * of state called something with "error" in it turns truthy and a coloured
 * box appears above the form. A box appearing is not an event. A reader using
 * a screen reader submits, hears nothing, and is left deciding whether the
 * button worked, which is the same dead end a sighted reader would be in with
 * the message rendered in the page background colour.
 *
 * Thirty two of these existed and not one was announced. `role="alert"` is
 * the whole fix: the box is already rendered only when there is something to
 * say, which is exactly the shape a live region wants.
 *
 * Two shapes are deliberately not matched. A control is not a message, so a
 * `Button` that only renders while something is wrong is left alone. And a
 * field level message carrying an `id` is already reachable, because the
 * input names it in `aria-describedby` and announces it on focus; `Input`
 * does that and does not want a second announcement on top.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = ["src/app", "src/core/components", "module-sources"];

/** Elements that are not messages, whose state belongs in `aria-*` instead. */
const CONTROLS = new Set(["Button", "button", "Input", "input", "Textarea", "textarea"]);

const ANNOUNCED = /role\s*=\s*"(alert|status)"|aria-live/;
const FIELD_LEVEL = /\bid\s*=/;

/** `{somethingError && (<Tag ...>`, which is how every screen renders one. */
const ERROR_BOX = /\{\s*(\w*[Ee]rror\w*)\s*&&\s*\(?\s*\n?\s*<(\w+)([^>]*?)>/g;

function tsxFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) tsxFiles(full, out);
        else if (entry.name.endsWith(".tsx")) out.push(full);
    }
    return out;
}

function unannounced(): string[] {
    const found: string[] = [];
    for (const base of SCANNED) {
        for (const file of tsxFiles(path.join(ROOT, base))) {
            const source = fs.readFileSync(file, "utf8");
            for (const match of source.matchAll(ERROR_BOX)) {
                const [, , tag, attributes] = match;
                if (CONTROLS.has(tag)) continue;
                if (ANNOUNCED.test(attributes) || FIELD_LEVEL.test(attributes)) continue;
                const line = source.slice(0, match.index).split("\n").length;
                found.push(`${path.relative(ROOT, file)}:${line} <${tag}>`);
            }
        }
    }
    return found;
}

describe("a message that reports a failure", () => {
    it("is announced rather than only drawn", () => {
        const silent = unannounced();
        expect(
            silent,
            `these render a failure with nothing to announce it. Add role="alert" to the element:\n${silent.join("\n")}`,
        ).toEqual([]);
    });

    it("is looked for in the screens that have one", () => {
        // Guards the scanner itself: a regex that silently stops matching
        // would make the test above pass by finding nothing at all.
        const boxes = SCANNED.flatMap((base) => tsxFiles(path.join(ROOT, base)))
            .map((f) => [...fs.readFileSync(f, "utf8").matchAll(ERROR_BOX)].length)
            .reduce((a, b) => a + b, 0);
        expect(boxes).toBeGreaterThan(20);
    });
});
