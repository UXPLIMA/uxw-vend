import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A control is one element, not a link with a button inside it.
 *
 * `<Link href><Button>Sign in</Button></Link>` renders `<a><button>`, which
 * the HTML spec forbids: an anchor may not contain interactive content. What a
 * person gets is two tab stops for one control, and two different activation
 * rules - Enter on the anchor navigates, Space on the button does nothing.
 * Measured on the served markup of every public page: the navbar's sign-in and
 * register controls came back with no accessible name at all, because the
 * words belong to the inner button and the outer anchor is what a reader
 * announces.
 *
 * `buttonClassName` has existed for this the whole time, and its own comment
 * says so: "Some controls that should look like a button have to be an
 * anchor". Pagination, the admin page header and the media uploader already
 * ask it for the classes and stay one element. These are the ones that did not.
 *
 * The modules are pinned rather than fixed: `buttonClassName` is not part of
 * `@/core/sdk/ui`, so a module cannot reach it without adding a symbol to the
 * SDK surface, which is a version bump and its own change. The number may fall
 * and may not rise.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

/** How many module files still wrap a button in a link. Shrink only. */
const MODULE_SITES_PINNED = 40;

function tsxFiles(dir: string, into: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // `src/modules` is the installed runtime copy of what lives in
            // `module-sources`, and is gitignored. Scanning it would report
            // every module finding twice and let a fix to a copy nobody
            // commits turn this green.
            if (["generated", "node_modules", "modules"].includes(entry.name)) continue;
            tsxFiles(full, into);
        } else if (entry.name.endsWith(".tsx")) into.push(full);
    }
    return into;
}

/** `<Link ...>` or `<a ...>` whose next thing is a `<Button`. */
function nestedControls(root: string): string[] {
    const found: string[] = [];
    for (const file of tsxFiles(root)) {
        const source = fs.readFileSync(file, "utf8");
        for (const m of source.matchAll(/<(Link|a)\b[^>]*>\s*<Button\b/g)) {
            const line = source.slice(0, m.index).split("\n").length;
            found.push(`${path.relative(ROOT, file)}:${line}`);
        }
    }
    return found.sort();
}

describe("a control that navigates", () => {
    it("is one element in core, not an anchor wrapped round a button", () => {
        expect(nestedControls(path.join(ROOT, "src"))).toEqual([]);
    });

    it("is not becoming more common in the modules", () => {
        const sites = nestedControls(path.join(ROOT, "module-sources"));
        expect(
            sites.length,
            `${sites.length} module sites wrap a button in a link. The list may shrink and may not grow:\n${sites.join("\n")}`,
        ).toBeLessThanOrEqual(MODULE_SITES_PINNED);
    });
});
