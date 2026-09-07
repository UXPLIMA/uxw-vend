import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * `npm run clean` has to name every directory a build in this repository can
 * land in.
 *
 * There are two. `next build` writes `.next`, and anything run through
 * `NEXT_DIST_DIR` writes somewhere else - `npm run verify` sets it to
 * `.next-prod` so that building does not disturb a dev server serving out of
 * `.next`. The tidy-up knew about the first only, so every verified round left
 * a second copy of the build behind: measured at 1.4 GB on 2026-09-07, next to
 * a 5.1 GB `.next`, and invisible to the one command a person runs to get the
 * space back.
 *
 * The set is derived from the repository rather than written out here, so a
 * third build directory arrives with this test already asking about it.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/** Files that may choose a build directory. */
const CHOOSERS = ["scripts/verify.ts", "next.config.ts", "package.json"];

/**
 * Every directory a build can write to: `.next` by default, plus every literal
 * a `NEXT_DIST_DIR` is set to.
 */
function buildDirectories(): string[] {
    const dirs = new Set<string>([".next"]);
    for (const file of CHOOSERS) {
        const source = read(file);
        for (const m of source.matchAll(/NEXT_DIST_DIR\s*[:=]\s*["']([^"']+)["']/g)) {
            dirs.add(m[1]);
        }
    }
    return [...dirs];
}

const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;

describe("npm run clean", () => {
    it("removes every directory a build in this repository can land in", () => {
        const dirs = buildDirectories();
        // The default plus at least one alternate: if this drops to one, the
        // derivation above stopped finding what it is meant to find.
        expect(dirs.length).toBeGreaterThan(1);
        for (const dir of dirs) {
            expect(scripts.clean, `clean should remove ${dir}`).toContain(dir);
        }
    });

    it("still drops the package manager's cache, which is the other half of the space", () => {
        expect(scripts.clean).toContain("node_modules/.cache");
    });
});

describe("git", () => {
    it("ignores every build directory, so a verified round cannot be committed", () => {
        const ignore = read(".gitignore");
        for (const dir of buildDirectories()) {
            const covered =
                ignore.includes(`/${dir}/`) ||
                ignore.includes(`${dir}\n`) ||
                // A glob covering the alternates, which is how this file does it.
                new RegExp(`^/?${dir.split("-")[0]}-\\*/?$`, "m").test(ignore);
            expect(covered, `${dir} should be gitignored`).toBe(true);
        }
    });
});
