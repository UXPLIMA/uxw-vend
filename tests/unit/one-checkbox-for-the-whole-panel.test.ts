import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * There is one checkbox, and this is how it stays one.
 *
 * Twenty-nine screens had written `<input type="checkbox">` by hand, between
 * them using ten different class strings - `rounded`, `w-4 h-4`, `w-3 h-3`,
 * `mt-1`, `accent-primary`, and five that said nothing at all. The result was
 * boxes of different sizes on adjacent screens, all of them painted by the
 * operating system rather than the theme: the system's blue on light, and a
 * white box with a black hairline on a dark panel, whatever colours the site
 * had chosen.
 *
 * `Checkbox` and `CheckboxField` in `@/core/sdk/ui` are the answer. This test
 * is the part that keeps the thirtieth from being written by hand.
 */

const ROOT = join(__dirname, "..", "..");

function grep(pattern: string, paths: string[]): string[] {
    try {
        return execFileSync("grep", ["-rn", "--include=*.tsx", pattern, ...paths], {
            cwd: ROOT,
            encoding: "utf8",
        })
            .split("\n")
            .filter(Boolean);
    } catch {
        return []; // grep exits 1 when it matches nothing
    }
}

describe("one checkbox for the whole panel", () => {
    it("declares type=checkbox in exactly one component", () => {
        const offenders = grep('type="checkbox"', ["src", "module-sources"])
            .filter((line) => !line.startsWith("src/core/components/ui/checkbox.tsx:"))
            // src/modules is a build-time copy of module-sources; a fix has to
            // land in the source, and the copy follows on the next rsync.
            .filter((line) => !line.startsWith("src/modules/"));
        expect(offenders).toEqual([]);
    });

    it("is actually used, in core and in the modules alike", () => {
        // If the component were only exported and never mounted, the test
        // above would pass on an empty panel.
        const core = grep("<Checkbox", ["src"]).filter((l) => !l.startsWith("src/modules/"));
        const modules = grep("<Checkbox", ["module-sources"]);
        expect(core.length).toBeGreaterThan(5);
        expect(modules.length).toBeGreaterThan(5);
    });
});
