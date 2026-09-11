/**
 * The pointer over a control that can be pressed.
 *
 * Tailwind v4's preflight gives `button` a `cursor: default`, which is a
 * deliberate change from v3 and the right default for a reset - a button is
 * not a link. It is the wrong default for this product, where every button is
 * something a visitor is meant to click, and it applied to all of them:
 * measured against the running site, the buttons on a help article reported
 * `default` rather than `pointer`.
 *
 * The shared `Button` component carries `cursor-pointer` in its class list, so
 * anything built from it was fine and the gap was invisible in the places
 * people look first. Everywhere else - 107 raw `<button>` tags across 64 files
 * at the time of writing - the arrow stayed, and a visitor reads an arrow as
 * "this is not for me".
 *
 * One rule rather than 107 edits, because the next raw button somebody writes
 * would otherwise start out wrong again. `:not(:disabled)` keeps the arrow
 * where an arrow is correct: a control that cannot be pressed should not
 * pretend otherwise.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

describe("a control that can be pressed", () => {
    it("is given a pointer, since the framework's reset takes it away", () => {
        expect(css).toMatch(/button:not\(:disabled\)/);
        expect(css).toMatch(/cursor:\s*pointer/);
    });

    it("covers the things that behave like a button without being one", () => {
        // A div carrying role="button" is a button to a screen reader and to
        // anybody using it, so it should read the same to a mouse.
        expect(css).toContain('[role="button"]');
    });

    it("leaves the arrow where the control cannot be pressed", () => {
        // `:not(:disabled)` and the aria equivalent, so a disabled control
        // keeps saying so with the cursor as well as with its opacity.
        expect(css).toMatch(/\[role="button"\]:not\(\[aria-disabled="true"\]\)/);
    });
});
