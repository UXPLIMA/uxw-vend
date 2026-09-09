// @vitest-environment node
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * No emoji in the product, in code or on screen. Icons come from lucide.
 *
 * This is a house rule, and like the em dash gate beside it, a rule nobody
 * checks is a rule that drifts. Six of them had: a thumbs-up and a thumbs-down
 * counting article feedback, a folder standing in for a missing category
 * image, and two flags in the locale table.
 *
 * One of the six was not cosmetic. The forum's admin offered an emoji as the
 * placeholder for a category icon while the public forum page renders that
 * same field through `NavIcon`, which knows lucide names and nothing else. An
 * operator who took the hint picked an icon the site would never draw.
 *
 * The scan is over what ships: source, module sources and the catalogues. A
 * test fixture may still hold an emoji, because a string testing that unicode
 * survives a round trip has to contain some.
 *
 * `©`, `®` and `™` are typography rather than emoji and stay. So do the
 * geometric shapes the move-up and move-down controls draw with, which are not
 * pictographs and which no font renders in colour.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = ["src", "module-sources", "messages-core", "prisma", "scripts"];

/** Anything a font would draw as a picture, plus the flag halves. */
const PICTOGRAPH = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const TYPOGRAPHY = new Set(["©", "®", "™"]);

function tracked(): string[] {
    const out = execFileSync("git", ["ls-files", "-z", ...SCANNED], {
        cwd: ROOT,
        maxBuffer: 64 * 1024 * 1024,
    });
    return out.toString("utf8").split("\0").filter(Boolean);
}

/** A NUL in the first 8KB is how git itself decides a blob is binary. */
function isBinary(buf: Buffer): boolean {
    return buf.subarray(0, 8192).includes(0);
}

describe("what the product is written in", () => {
    const files = tracked();

    it("finds the tree to scan", () => {
        expect(files.length).toBeGreaterThan(500);
    });

    it("carries no emoji", () => {
        const hits: string[] = [];
        for (const file of files) {
            let buf: Buffer;
            try {
                buf = fs.readFileSync(path.join(ROOT, file));
            } catch {
                continue;
            }
            if (isBinary(buf)) continue;
            const source = buf.toString("utf8");
            if (!PICTOGRAPH.test(source)) continue;

            source.split("\n").forEach((line, index) => {
                for (const char of line) {
                    if (TYPOGRAPHY.has(char) || !PICTOGRAPH.test(char)) continue;
                    hits.push(`${file}:${index + 1}: ${line.trim().slice(0, 90)}`);
                    return;
                }
            });
        }
        expect(hits, `use a lucide icon instead:\n${hits.join("\n")}`).toEqual([]);
    });
});
