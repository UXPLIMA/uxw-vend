// @vitest-environment node
/**
 * A module ships what is in the repository, not what is on this machine.
 *
 * Everything downstream reads the working tree. `build:marketplace` zips the
 * directory, `check-marketplace-sync` compares the zip against the same
 * directory, the type check compiles it, and the dev server serves it. A file
 * that exists here and is not committed passes every one of those and is
 * missing from a fresh clone, from CI, and from the module somebody installs.
 *
 * It happened. A new admin route went into `pages/admin/messages/`, and line
 * 129 of `.gitignore` said `messages/` - written for the legacy translation
 * directory at the root, matching every directory of that name at any depth.
 * The screen worked locally, the marketplace zip contained it because the zip
 * is built from disk, and the repository did not have it.
 *
 * So this asks git which files it is refusing, rather than which it has. A
 * file merely not added yet is work in progress and nobody's business; a file
 * an ignore rule is swallowing is the defect, and it stays swallowed however
 * many times somebody types `git add`.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * The paths git is refusing to track, which is a different question from the
 * paths it has not been given.
 */
function ignoredUnder(dir: string): string[] {
    const out = execFileSync(
        "git",
        ["ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory", dir],
        { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 },
    );
    return out.toString("utf8").split("\0").filter(Boolean);
}

/** Ignored on purpose, and written down in the repository rules. */
const MEANT_TO_BE = [
    // Runtime install state. A fresh clone stays empty so core keeps knowing
    // nothing about which modules exist.
    "src/modules/",
    // Codegen output, rebuilt by `prebuild` on every machine.
    "src/core/generated/",
];

describe("what a module is made of", () => {
    it("is all of it in the repository", () => {
        const swallowed = ignoredUnder("module-sources");
        expect(
            swallowed,
            "an ignore rule is swallowing these, so a fresh clone does not have them:\n"
            + swallowed.join("\n"),
        ).toEqual([]);
    });
});

describe("what core is made of", () => {
    it("is all of it in the repository, bar what the rules say to leave out", () => {
        const swallowed = ignoredUnder("src")
            .filter((file) => !MEANT_TO_BE.some((allowed) => file.startsWith(allowed)));
        expect(
            swallowed,
            "an ignore rule is swallowing these:\n" + swallowed.join("\n"),
        ).toEqual([]);
    });
});
