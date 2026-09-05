import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A component under a capability directory is declared, or it is dead.
 *
 * `widgets/` and `slots/` are not ordinary source folders. Core renders what
 * the manifest names there and nothing else, resolving the export by the id it
 * was given, so a file the manifest never mentions reaches no page at all.
 *
 * Two finished widgets sat in `store/widgets/` without an entry: a payment
 * goal bar and a top credit loaders list, both translated into every locale
 * the module ships, both reading endpoints that answer, and the homepage they
 * were written for never knew about them.
 *
 * `scripts/validate-module.ts` carries the same rule for a single module; this
 * runs it over every module in `npm test`.
 */

const SOURCES = path.join(process.cwd(), "module-sources");
const CAPABILITY_DIRS = ["widgets", "slots"];

/** Relative import targets, resolved, for every source file under `dir`. */
export function relativeImports(dir: string, read = fs): Set<string> {
    const found = new Set<string>();
    const walk = (current: string) => {
        for (const entry of read.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== "node_modules") walk(full);
                continue;
            }
            if (!/\.tsx?$/.test(entry.name)) continue;
            const source = read.readFileSync(full, "utf8") as string;
            for (const match of source.matchAll(/(?:from|import\(\s*)\s*["'`](\.[^"'`]+)["'`]/g)) {
                found.add(path.normalize(path.join(path.dirname(full), match[1])));
            }
        }
    };
    walk(dir);
    return found;
}

/** Files under a capability directory that neither the manifest nor another file names. */
export function undeclaredCapabilityFiles(
    files: string[],
    manifest: string,
    imported: Set<string>,
    dirOf: (file: string) => string,
): string[] {
    return files.filter((file) => {
        const dir = dirOf(file);
        const stem = path.basename(file).replace(/\.tsx?$/, "");
        if (manifest.includes(`${dir}/${stem}`)) return false;
        return !imported.has(file.replace(/\.tsx?$/, ""));
    });
}

function modulesWithOrphans(): string[] {
    const offenders: string[] = [];
    for (const moduleName of fs.readdirSync(SOURCES).sort()) {
        const base = path.join(SOURCES, moduleName);
        const manifestPath = path.join(base, "module.json");
        if (!fs.existsSync(manifestPath)) continue;
        const manifest = fs.readFileSync(manifestPath, "utf8");
        const imported = relativeImports(base);

        for (const dir of CAPABILITY_DIRS) {
            const full = path.join(base, dir);
            if (!fs.existsSync(full)) continue;
            const files = fs
                .readdirSync(full)
                .filter((f) => /\.tsx?$/.test(f))
                .map((f) => path.join(full, f));
            for (const orphan of undeclaredCapabilityFiles(files, manifest, imported, () => dir)) {
                offenders.push(`${moduleName}: ${path.relative(base, orphan)}`);
            }
        }
    }
    return offenders;
}

describe("module capability components", () => {
    it("has capability directories to check", () => {
        const withDirs = fs
            .readdirSync(SOURCES)
            .filter((m) => CAPABILITY_DIRS.some((d) => fs.existsSync(path.join(SOURCES, m, d))));
        expect(withDirs.length).toBeGreaterThan(3);
    });

    it("every widget and slot component is declared", () => {
        expect(modulesWithOrphans()).toEqual([]);
    });

    it("the store's six widgets are all declared, and each names a file that exists", () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(SOURCES, "store/module.json"), "utf8"));
        const declared: { id: string; component: string }[] = manifest.widgets;
        expect(declared).toHaveLength(6);
        for (const widget of declared) {
            const file = path.join(SOURCES, "store", `${widget.component}.tsx`);
            expect(fs.existsSync(file), widget.component).toBe(true);
            // Core resolves the export by the declared id.
            expect(fs.readFileSync(file, "utf8"), widget.id).toContain(`export function ${widget.id}`);
        }
    });

    // Self-tests: the check is worth its runtime only if it fails on the shape
    // it exists to catch.
    it("undeclaredCapabilityFiles finds what nothing names", () => {
        const files = ["/m/widgets/a.tsx", "/m/widgets/b.tsx", "/m/widgets/c.tsx"];
        const manifest = '{"widgets":[{"component":"widgets/a"}]}';
        const imported = new Set(["/m/widgets/b"]);
        expect(undeclaredCapabilityFiles(files, manifest, imported, () => "widgets")).toEqual([
            "/m/widgets/c.tsx",
        ]);
    });

    it("undeclaredCapabilityFiles does not take a prefix for a declaration", () => {
        const files = ["/m/slots/banner-extra.tsx"];
        const manifest = '{"slots":[{"component":"slots/banner"}]}';
        expect(undeclaredCapabilityFiles(files, manifest, new Set(), () => "slots")).toEqual([
            "/m/slots/banner-extra.tsx",
        ]);
    });
});
