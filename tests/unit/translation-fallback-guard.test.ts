import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * `t("key") || "fallback"` reads like a safety net and is not one.
 *
 * next-intl does not throw on a missing message: it logs and returns the key
 * path, so `t("error_title")` yields the non-empty string
 * "common.error_title" and the `||` never fires. The screen renders the key
 * where the copy should be, which is exactly the failure the fallback was
 * written to prevent. `t.has(key) ? t(key) : fallback` is the supported guard.
 *
 * The error boundary and the custom-forms admin page both shipped this way.
 */
const DEAD_FALLBACK = /\bt\(\s*["'`][^"'`]+["'`]\s*\)\s*\|\|/;

/** Same trap one level up: a namespace object read straight off the catalogue. */
const SOURCE_DIRS = ["src", "module-sources"];

/**
 * Skipped by full path, not by directory name. `src/modules` is
 * installed-module state, a copy of module-sources refreshed on install and not
 * the repo's to police. A name-based skip also swallowed
 * `src/app/[locale]/(admin)/admin/modules`, which is core's own screen for
 * managing them and very much in scope.
 */
const SKIP_PATHS = new Set([
    path.join(ROOT, "src", "modules"),
    path.join(ROOT, "src", "core", "generated"),
]);

function sources(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || SKIP_PATHS.has(full)) continue;
                walk(full);
                continue;
            }
            if (/\.tsx?$/.test(entry.name)) out.push(full);
        }
    };
    walk(dir);
    return out;
}

describe("translation fallbacks", () => {
    it("nobody writes t(\"key\") || \"fallback\"", () => {
        const offenders: string[] = [];
        for (const dir of SOURCE_DIRS) {
            for (const file of sources(path.join(ROOT, dir))) {
                const content = fs.readFileSync(file, "utf8");
                content.split("\n").forEach((line, i) => {
                    if (DEAD_FALLBACK.test(line)) {
                        offenders.push(`${path.relative(ROOT, file)}:${i + 1}`);
                    }
                });
            }
        }
        expect(offenders).toEqual([]);
    });

    it("the error boundary guards with t.has", () => {
        const content = fs.readFileSync(path.join(ROOT, "src/app/[locale]/error.tsx"), "utf8");
        expect(content).toContain("t.has(key)");
    });
});
