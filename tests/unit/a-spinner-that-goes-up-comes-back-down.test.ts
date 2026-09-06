/**
 * Whatever raises a loading spinner has to lower it when the request fails.
 *
 * The submissions screen read `setLoading(true)`, awaited a fetch, and called
 * `setLoading(false)` on the line after it. A rejected fetch - a dropped
 * connection, a server that went away mid-deploy - skipped that line, and the
 * spinner turned until the admin reloaded the page. The analytics screen was
 * one edit away from the same thing: its clear was unconditional only because
 * every `try` above it happened to still have a `catch`.
 *
 * So the proof has to be syntactic rather than something a reader
 * reconstructs. A function that raises the spinner must lower it somewhere a
 * failure actually reaches: a `finally`, a `catch`, or the promise-chain
 * spellings of the two. Where it lowers it on the happy path as well is its
 * own business - this only cares that the failing path is covered.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "module-sources"];

/**
 * The flags a screen raises while it waits. `loading` puts a spinner on the
 * page; the rest disable the button that was just pressed, which strands the
 * admin just as thoroughly - a Save that never re-enables needs a reload
 * before it can be pressed again.
 */
const FLAGS = ["Loading", "IsLoading", "Saving", "Submitting", "Busy", "Sending", "Deleting", "Uploading", "Processing"];

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // src/modules is an rsync of module-sources; walking both would
            // report every module screen twice and make the result depend on
            // which modules this checkout happens to have installed.
            if (entry.name === "node_modules" || entry.name === "generated") continue;
            if (full === path.join("src", "modules")) continue;
            walk(full, out);
        } else if (entry.name.endsWith(".tsx")) {
            out.push(full);
        }
    }
    return out;
}

/** The innermost braced block containing `index`. */
function enclosingBlock(source: string, index: number): string | null {
    let depth = 0;
    let start = -1;
    for (let i = index; i >= 0; i--) {
        if (source[i] === "}") depth++;
        else if (source[i] === "{") {
            if (depth === 0) { start = i; break; }
            depth--;
        }
    }
    if (start < 0) return null;
    depth = 0;
    for (let j = start; j < source.length; j++) {
        if (source[j] === "{") depth++;
        else if (source[j] === "}" && --depth === 0) return source.slice(start, j + 1);
    }
    return null;
}

/**
 * The spellings that put the clear on a failing path. `finally`/`catch` cover
 * async-await; `.finally(`/`.catch(` cover the promise chains that predate it
 * and are still the right shape for a `Promise.all` of two fetches.
 */
function clearsOnFailure(body: string, flag: string): boolean {
    const clears = new RegExp(`set${flag}\\(false\\)`);
    for (const keyword of ["finally", "catch"]) {
        const block = new RegExp(`\\b${keyword}\\b[^{]*\\{`, "g");
        for (const opened of body.matchAll(block)) {
            const inner = enclosingBlock(body, opened.index + opened[0].length - 1);
            if (inner && clears.test(inner)) return true;
        }
        const chained = new RegExp(`\\.${keyword}\\(([\\s\\S]{0,300}?)\\)\\s*[;.]`, "g");
        for (const call of body.matchAll(chained)) {
            if (clears.test(call[1])) return true;
        }
    }
    return false;
}

describe("a spinner that goes up comes back down", () => {
    const files = ROOTS.flatMap((root) => walk(root));

    it("has screens to check", () => {
        expect(files.length).toBeGreaterThan(350);
    });

    it("clears the flag on the failing path everywhere it sets it", () => {
        const raises = new RegExp(`set(${FLAGS.join("|")})\\(true\\)`, "g");
        const stuck: string[] = [];
        for (const file of files) {
            const source = fs.readFileSync(file, "utf8");
            for (const raised of source.matchAll(raises)) {
                const body = enclosingBlock(source, raised.index);
                if (!body) continue;
                if (!clearsOnFailure(body, raised[1])) {
                    const line = source.slice(0, raised.index).split("\n").length;
                    stuck.push(`${file}:${line} set${raised[1]}`);
                }
            }
        }
        expect(stuck).toEqual([]);
    });
});
