/**
 * Why the zip advisory against this project's extractor does not reach it.
 *
 * `adm-zip` carries an open advisory: its own extraction helpers follow a
 * symlink in the archive to the destination, so an entry can be made to
 * overwrite a file anywhere the process can write. There is no fixed release -
 * the advisory covers every version from 0.5.9 up, including the current one -
 * and the only "fix" npm offers is a downgrade to a release that predates the
 * report. So the advisory cannot be closed by upgrading and has to be answered
 * by not using the part that is vulnerable.
 *
 * This project never calls it. A module ZIP arrives from outside - uploaded by
 * an admin, or pulled from the marketplace - and every route that unpacks one
 * walks the entries itself: resolve the destination, refuse anything that
 * lands outside the target directory, and write the bytes as a plain file. A
 * symlink entry is written as a regular file whose contents happen to be a
 * path, which is inert.
 *
 * That is a property of five call sites rather than of the library, which is
 * exactly the kind of thing that stops being true in six months. A sixth route
 * reaching for `extractAllTo` because it is one line shorter would hand the
 * advisory a way in, and nothing else in the build would notice.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEARCH = ["src", "scripts", "module-sources"];

/** adm-zip's own extractors: these are the ones that follow a symlink. */
const LIBRARY_EXTRACTORS = /\.(extractAllTo|extractEntryTo|extractAllToAsync)\s*\(/;

function sources(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "generated") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sources(full, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

const files = SEARCH.flatMap((dir) => sources(path.join(ROOT, dir)));

/**
 * Files that open an archive somebody else produced *and put it on disk*.
 *
 * Reading one without writing anything is a different job with none of this
 * risk - the marketplace sync check opens every ZIP to compare it against the
 * sources and never unpacks a byte.
 */
const unpackers = files.filter((file) => {
    const body = fs.readFileSync(file, "utf8");
    return body.includes("new AdmZip(") && body.includes("getEntries()") && /writeFile\(/.test(body);
});

describe("unpacking an archive from outside", () => {
    it("is something this project actually does", () => {
        // Without this the gate below passes on a project that stopped
        // unpacking anything, and stops being evidence of the thing it is
        // evidence of.
        expect(unpackers.length).toBeGreaterThanOrEqual(4);
    });

    it("never hands the job to the library's own extractor", () => {
        const offenders = files
            .filter((file) => LIBRARY_EXTRACTORS.test(fs.readFileSync(file, "utf8")))
            .map((file) => path.relative(ROOT, file));
        expect(
            offenders,
            "adm-zip's extractors follow a symlink in the archive to the destination, " +
            "and the advisory for that has no fixed release. Walk the entries and write " +
            "them yourself, the way the other routes do.",
        ).toEqual([]);
    });

    it("checks every entry lands inside the directory it is unpacking into", () => {
        const missing = unpackers
            .filter((file) => {
                const body = fs.readFileSync(file, "utf8");
                // A resolved destination compared against a resolved root.
                return !/path\.resolve\(/.test(body) || !/startsWith\(/.test(body);
            })
            .map((file) => path.relative(ROOT, file));
        expect(missing).toEqual([]);
    });

    it("gets the bytes from the entry rather than asking the library to place them", () => {
        const missing = unpackers
            .filter((file) => !/entry\.getData\(\)|\.getData\(\)/.test(fs.readFileSync(file, "utf8")))
            .map((file) => path.relative(ROOT, file));
        expect(missing).toEqual([]);
    });
});
