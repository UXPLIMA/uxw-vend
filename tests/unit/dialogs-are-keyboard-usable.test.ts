import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * `role="dialog"` is a claim about keyboard behaviour, and with
 * `aria-modal="true"` it is a claim that the rest of the page is inert. The
 * DOM enforces none of it. A dialog without a focus trap lets Tab walk out
 * into the page behind the overlay, which is still fully interactive and, to a
 * sighted keyboard user, hidden under a black scrim; without focus
 * restoration, closing it drops focus on the body so the next Tab starts again
 * at the top of the page; without an Escape handler there is no keyboard exit
 * at all, and several of these dialogs could only be closed by clicking their
 * backdrop.
 *
 * Twelve components carried the markup. One carried the behaviour. That one is
 * now `useModalDialog`, and this requires every dialog to use it rather than
 * hand-rolling a keydown listener that covers a third of the problem.
 *
 * The hook itself is tested in `use-modal-dialog.test.tsx`; this only checks
 * that nothing draws a dialog without it.
 */

const ROOT = path.resolve(__dirname, "../..");
const SEARCH_DIRS = ["src", "module-sources"];

/**
 * Skipped by full path, not by directory name. `src/modules` is installed-module
 * state, regenerated on install and not the repo's to police; `src/app/.../
 * admin/modules` is core's own screen for managing them, and a name-based skip
 * quietly exempted it.
 */
const SKIP_PATHS = new Set([
    path.join(ROOT, "src", "modules"),
    path.join(ROOT, "node_modules"),
    path.join(ROOT, "src", "core", "generated"),
]);

function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir) || SKIP_PATHS.has(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith(".tsx")) out.push(full);
    }
    return out;
}

const dialogFiles = SEARCH_DIRS.flatMap((d) => walk(path.join(ROOT, d)))
    .map((file) => ({ file: path.relative(ROOT, file), body: fs.readFileSync(file, "utf8") }))
    .filter(({ body }) => /role="dialog"/.test(body));

describe("dialogs", () => {
    it("finds the components that draw one", () => {
        expect(dialogFiles.length).toBeGreaterThanOrEqual(12);
    });

    it("gives every one of them the shared keyboard behaviour", () => {
        const bare = dialogFiles
            .filter(({ body }) => !body.includes("useModalDialog"))
            .map(({ file }) => file);
        expect(bare).toEqual([]);
    });

    it("attaches the hook's ref to something", () => {
        const unattached = dialogFiles
            .filter(({ body }) => !/ref=\{\w+\}/.test(body))
            .map(({ file }) => file);
        expect(unattached).toEqual([]);
    });

    it("leaves no hand-rolled Escape listener beside the hook", () => {
        // The hook owns Escape. A second listener on the same dialog is either
        // dead or fighting it, and both were true here before.
        const handRolled = dialogFiles
            .filter(({ body }) => /['"]Escape['"]/.test(body))
            .map(({ file }) => file);
        expect(handRolled).toEqual([]);
    });

    it("keeps the hook available to modules through the published SDK", () => {
        const sdk = fs.readFileSync(path.join(ROOT, "src", "core", "sdk", "ui.ts"), "utf8");
        expect(sdk).toMatch(/export \{[^}]*useModalDialog/);

        const moduleDialogs = dialogFiles.filter(({ file }) => file.startsWith("module-sources"));
        expect(moduleDialogs.length).toBeGreaterThan(0);
        for (const { file, body } of moduleDialogs) {
            expect(body, `${file} should reach the hook through @/core/sdk/ui`).toMatch(
                /useModalDialog[^;]*from "@\/core\/sdk\/ui"|from "@\/core\/sdk\/ui"[^;]*useModalDialog/,
            );
        }
    });
});
