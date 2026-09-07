import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The tree reads as a product, not as the output of a scaffolder.
 *
 * `create-next-app` writes five SVGs into `public/`: the Next wordmark, the
 * Vercel triangle, and the globe, file and window glyphs its starter page
 * arranges in a row. They survive because nothing ever fails on them. They
 * are served, they cost a reader nothing at runtime, and they sit next to
 * assets that are load-bearing.
 *
 * They cost a reader something else. Measured here: eighteen files under
 * `public/`, and the only ones with zero references anywhere in `src`,
 * `module-sources`, `scripts`, `prisma`, `.github`, the manifest or the
 * config were these five and the background images. Someone auditing which
 * assets matter has to establish, one file at a time, that a Vercel logo in
 * a repository that is not deployed to Vercel means nothing.
 *
 * The match is on content rather than on name. A file called `next.svg` is
 * only the scaffolder's if it draws the scaffolder's mark; renaming it would
 * walk past a name list without touching the reason the file is unwanted.
 */

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../public");

/**
 * Fragments of the paths `create-next-app` ships. Each is taken from the
 * `d` attribute of the starter asset it identifies and appears in no
 * drawing anyone here would author by hand.
 */
const SCAFFOLDER_MARKS: ReadonlyArray<{ readonly asset: string; readonly drawing: string }> = [
    { asset: "the Vercel triangle", drawing: "m577.3 0 577.4 1000H0z" },
    { asset: "the Next wordmark", drawing: "M262 0h68.5v12.7h-27.2v66.6h-13.6V12.7H262V0Z" },
    { asset: "the starter globe", drawing: "M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45" },
    { asset: "the starter file glyph", drawing: "M14.5 13.5V5.41a1 1 0 0 0-.3-.7L9.8.29" },
    { asset: "the starter window glyph", drawing: "M1.5 2.5h13v10a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" },
];

function svgFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) svgFiles(full, out);
        else if (full.endsWith(".svg")) out.push(full);
    }
    return out;
}

describe("the shipped tree", () => {
    it("carries no drawing the scaffolder left behind", () => {
        const found = svgFiles(PUBLIC_DIR).flatMap((file) => {
            const body = fs.readFileSync(file, "utf8");
            return SCAFFOLDER_MARKS.filter((mark) => body.includes(mark.drawing)).map(
                (mark) => `${path.relative(PUBLIC_DIR, file)} draws ${mark.asset}`,
            );
        });

        expect(found).toEqual([]);
    });
});
