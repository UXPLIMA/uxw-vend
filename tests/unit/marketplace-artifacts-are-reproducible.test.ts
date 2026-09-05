import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

/**
 * A published archive is a function of what the module says, and nothing else.
 *
 * `zip -r` writes each file's mtime and atime into the entry, so the bytes of a
 * published ZIP depended on when someone last opened the file rather than on
 * what the file contained. Merely reading a module.json and rebuilding produced
 * a different artifact: two commits in this repository carried .zip changes for
 * modules nobody had touched. A fresh clone, where git sets every mtime to
 * checkout time, could not reproduce any of the seventy-eight. Entry order came
 * from readdir, which is not stable across filesystems either.
 *
 * That costs three things. Review noise, where an unrelated archive shows as
 * modified. Any integrity check keyed on the archive's hash, which can never
 * agree twice. And the ability to answer "is the published ZIP the one this
 * source builds" by comparing bytes.
 *
 * `index.json` had the same shape of problem one level up: every module's
 * `updatedAt` was stamped with the build clock, so the catalogue claimed all
 * seventy-eight were updated today after any build, and the admin modules
 * screen, which prints that date and sorts by it, said so.
 */

const ROOT = process.cwd();
const MARKETPLACE = path.join(ROOT, "module-marketplace");
const SCRIPT = path.join(ROOT, "scripts/build-marketplace.sh");

/** The ZIP epoch, matching ZIP_EPOCH in the build script. */
const EPOCH = { year: 1980, month: 1, day: 1 };

function archives(): string[] {
    return fs
        .readdirSync(MARKETPLACE)
        .filter((f) => f.endsWith(".zip"))
        .sort();
}

describe("every published archive", () => {
    const names = archives();

    it("is there to check", () => {
        expect(names.length).toBeGreaterThan(50);
    });

    it("carries no timestamp taken from the filesystem", () => {
        const offenders: string[] = [];
        for (const name of names) {
            for (const entry of new AdmZip(path.join(MARKETPLACE, name)).getEntries()) {
                const when = entry.header.time;
                if (
                    when.getFullYear() !== EPOCH.year ||
                    when.getMonth() + 1 !== EPOCH.month ||
                    when.getDate() !== EPOCH.day
                ) {
                    offenders.push(`${name}: ${entry.entryName} at ${when.toISOString()}`);
                    break;
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it("lists its entries in one order any machine would produce", () => {
        const unsorted: string[] = [];
        for (const name of names) {
            const entries = new AdmZip(path.join(MARKETPLACE, name)).getEntries().map((e) => e.entryName);
            if (entries.join("\n") !== [...entries].sort().join("\n")) unsorted.push(name);
        }
        expect(unsorted).toEqual([]);
    });

    it("holds files only, so no directory entry can vary", () => {
        const withDirs: string[] = [];
        for (const name of names) {
            const dirs = new AdmZip(path.join(MARKETPLACE, name)).getEntries().filter((e) => e.isDirectory);
            if (dirs.length > 0) withDirs.push(`${name}: ${dirs.length}`);
        }
        expect(withDirs).toEqual([]);
    });
});

describe("the build script", () => {
    const source = fs.readFileSync(SCRIPT, "utf8");

    it("writes the archive itself rather than shelling to zip", () => {
        expect(source).toContain("ZIP_EPOCH");
        expect(source).toContain("def write_zip");
        // In code, not in the comment that explains why it is gone.
        const code = source
            .split("\n")
            .filter((line) => !line.trim().startsWith("#"))
            .join("\n");
        expect(code).not.toMatch(/\bzip -r\b/);
    });

    it("writes an archive only after the catalog validates", () => {
        // A module that breaks the SDK boundary, or listens to a hook nothing
        // emits, exits the script - and used to have a published ZIP already.
        const validated = source.indexOf("sys.exit(1)");
        const written = source.indexOf("write_zip(os.path.join(SOURCES_DIR");
        expect(validated).toBeGreaterThan(-1);
        expect(written).toBeGreaterThan(validated);
    });

    it("keeps a module's date unless its published version moved", () => {
        expect(source).toContain('prior.get("updatedAt") if prior.get("version") == version else None');
    });

    it("keeps shell syntax out of its unquoted heredoc", () => {
        // <<PYEOF, not <<'PYEOF', so the shell expands what is inside it. Four
        // backticks in a Python comment ran as command substitution and the
        // build died on a SyntaxError about a stray 0xff byte.
        const body = source.slice(source.indexOf("python3 - <<PYEOF"));
        expect(body).not.toContain("`");
    });
});

describe("the catalog", () => {
    const index = JSON.parse(fs.readFileSync(path.join(MARKETPLACE, "index.json"), "utf8")) as {
        updated: string;
        updatedAt: string;
        modules: { id: string; version: string; updatedAt: string; zip: string }[];
    };

    it("says it was updated when its newest module was, not when the build ran", () => {
        const newest = index.modules.map((m) => m.updatedAt).sort().at(-1);
        expect(index.updatedAt).toBe(newest);
        expect(index.updated).toBe(index.updatedAt.slice(0, 10));
    });

    it("dates no module later than the catalog", () => {
        const ahead = index.modules.filter((m) => m.updatedAt > index.updatedAt).map((m) => m.id);
        expect(ahead).toEqual([]);
    });

    it("points every entry at an archive that exists", () => {
        const missing = index.modules.filter((m) => !fs.existsSync(path.join(MARKETPLACE, m.zip))).map((m) => m.id);
        expect(missing).toEqual([]);
    });
});
