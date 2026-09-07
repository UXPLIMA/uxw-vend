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
        // The floor drops as modals turn into screens: the SEO overrides and
        // trophies editors were `role="dialog"` and are now routes of their
        // own, since a modal is the same screen wearing one address.
        expect(dialogFiles.length).toBeGreaterThanOrEqual(10);
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

/**
 * The two ways a panel escapes the check above: by not claiming to be a
 * dialog, and by never unmounting.
 *
 * The admin sidebar's mobile drawer draws the same full-page scrim every
 * dialog here draws, and closes on a click on it, but calls itself an `aside`
 * rather than a dialog, so a rule keyed on `role="dialog"` walked past it. It
 * had no Escape and no focus trap.
 *
 * It also stays mounted when closed and hides by sliding out of view with
 * `-translate-x-full`. A transform moves a thing; it does not remove it from
 * the tab order or from the accessibility tree. Below the `lg` breakpoint the
 * drawer is `display: flex` whether it is open or not, so tabbing across an
 * admin screen on a narrow viewport walked into a menu nobody could see.
 * `inert` is the attribute that means what the transform only looked like.
 */

/** Opening tags, with braces tracked so an arrow function's `>` does not end one. */
function openingTags(body: string): string[] {
    const tags: string[] = [];
    for (let i = 0; i < body.length; i++) {
        if (body[i] !== "<" || !/[a-zA-Z]/.test(body[i + 1] ?? "")) continue;
        let depth = 0;
        let j = i + 1;
        for (; j < body.length; j++) {
            const c = body[j];
            if (c === "{") depth++;
            else if (c === "}") depth--;
            else if (c === ">" && depth === 0) break;
        }
        tags.push(body.slice(i, j));
    }
    return tags;
}

const allTsx = SEARCH_DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((file) => ({
    file: path.relative(ROOT, file),
    body: fs.readFileSync(file, "utf8"),
}));

describe("a panel that covers the page", () => {
    it("is dismissible from the keyboard, whatever it calls itself", () => {
        const scrimmed = allTsx
            .filter(({ body }) =>
                openingTags(body).some(
                    (tag) => /fixed inset-0/.test(tag) && /onClick/.test(tag),
                ),
            )
            .filter(({ body }) => !body.includes("useModalDialog"))
            .map(({ file }) => file);

        expect(
            scrimmed,
            `These draw a scrim over the whole page and close when it is clicked.\n` +
            `Escape, focus restoration and the trap belong to useModalDialog, not to\n` +
            `a second copy of them here:\n${scrimmed.join("\n")}`,
        ).toEqual([]);
    });

    it("leaves the tab order when it slides out of view", () => {
        const parked = allTsx.flatMap(({ file, body }) =>
            openingTags(body)
                .filter((tag) => /-translate-[xy]-full/.test(tag) && !/\binert\b/.test(tag))
                .map(() => file),
        );

        expect(
            parked,
            `These hide by sliding off screen, which a keyboard still walks into.\n` +
            `Mark them inert while they are closed:\n${parked.join("\n")}`,
        ).toEqual([]);
    });
});
