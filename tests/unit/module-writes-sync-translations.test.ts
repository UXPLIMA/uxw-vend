import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A module's strings live in two places: the `translations` block of its
 * manifest, which is what the repo ships, and the `Translation` table, which
 * is what the site actually renders. The table is only ever filled by
 * `syncModuleTranslations`.
 *
 * Install, upload and bulk install all call it. Update did not. So a module
 * that gained a key in a new release kept rendering the set it shipped with on
 * the day it was first installed: the key was in the files, never in the
 * database, and the screen fell back to whatever the code had hardcoded, or
 * rendered the key path where there was no fallback. Nothing in the update
 * flow reported a problem, because from the file system's point of view the
 * upgrade had worked.
 *
 * Validating an incoming manifest is what marks a route as one that writes a
 * module's files, and every route that does must put that module's strings in
 * the table. Uninstall is the mirror image and calls `removeModuleTranslations`
 * instead; the read-only update check parses no manifest and appears here at
 * all only if someone gives it one.
 */

const ROOT = path.resolve(__dirname, "../..");
const API_DIR = path.join(ROOT, "src", "app", "api");

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name === "route.ts") out.push(full);
    }
    return out;
}

const manifestWriters = walk(API_DIR)
    .map((file) => ({ file, body: fs.readFileSync(file, "utf8") }))
    .filter(({ body }) => body.includes("moduleManifestSchema"));

describe("routes that write a module's files", () => {
    it("finds them", () => {
        expect(manifestWriters.length).toBeGreaterThanOrEqual(4);
    });

    it("puts every one of their modules' strings in the Translation table", () => {
        const unsynced = manifestWriters
            .filter(({ body }) => !body.includes("syncModuleTranslations("))
            .map(({ file }) => path.relative(ROOT, file));
        expect(unsynced).toEqual([]);
    });

    it("includes the update route, which is the one that was missing it", () => {
        const paths = manifestWriters.map(({ file }) => path.relative(ROOT, file));
        expect(paths).toContain(path.join("src", "app", "api", "v1", "modules", "update", "route.ts"));
    });
});

describe("uninstall", () => {
    const uninstall = fs.readFileSync(
        path.join(API_DIR, "v1", "modules", "[id]", "route.ts"),
        "utf8",
    );

    it("takes the module's strings back out instead", () => {
        expect(uninstall).toContain("removeModuleTranslations(");
        expect(uninstall).not.toContain("syncModuleTranslations(");
    });
});
