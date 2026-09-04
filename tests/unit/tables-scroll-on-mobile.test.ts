import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * A table wider than the phone it is read on has to scroll, not be cut off.
 *
 * The support ticket list is six columns wide and sat inside a wrapper with
 * `overflow-hidden`, which clips rather than scrolls: on a phone the last
 * columns were simply gone, with no way to reach them. Two admin tables were
 * the same. Core's own tables have always used `overflow-x-auto`; the modules
 * had not caught up.
 */
const SCROLLS = /overflow-x-auto|overflow-auto|overflow-x-scroll/;

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

function componentFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        if (!fs.existsSync(d)) return;
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || SKIP_PATHS.has(full)) continue;
                walk(full);
            } else if (/\.tsx$/.test(entry.name)) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

describe("tables on a narrow screen", () => {
    it("every table sits inside something that scrolls sideways", () => {
        const offenders: string[] = [];
        for (const dir of ["src", "module-sources"]) {
            for (const file of componentFiles(path.join(ROOT, dir))) {
                const source = fs.readFileSync(file, "utf8");
                for (const match of source.matchAll(/<(table|Table)\b/g)) {
                    // The wrapper is the element that opens just before it.
                    const before = source.slice(Math.max(0, (match.index ?? 0) - 500), match.index);
                    if (SCROLLS.test(before)) continue;
                    const line = source.slice(0, match.index).split("\n").length;
                    offenders.push(`${path.relative(ROOT, file)}:${line}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it("finds the tables it is meant to be checking", () => {
        const withTables = ["src", "module-sources"]
            .flatMap((d) => componentFiles(path.join(ROOT, d)))
            .filter((f) => /<table\b/.test(fs.readFileSync(f, "utf8")));
        expect(withTables.length).toBeGreaterThan(5);
    });

    it("no module hardcodes a divider colour where a theme token belongs", () => {
        const offenders: string[] = [];
        for (const file of componentFiles(path.join(ROOT, "module-sources"))) {
            const source = fs.readFileSync(file, "utf8");
            if (/divide-(gray|slate|zinc|neutral)-\d/.test(source)) {
                offenders.push(path.relative(ROOT, file));
            }
        }
        expect(offenders).toEqual([]);
    });
});
