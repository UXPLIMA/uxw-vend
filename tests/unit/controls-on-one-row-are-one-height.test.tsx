/**
 * Controls that sit next to each other are the same height.
 *
 * The filter row on the punishments page put a search box beside its type
 * buttons and they did not line up: the box was h-11 and the buttons h-8,
 * eleven pixels apart, so the row read as a mistake. It was not a mistake in
 * that page - core shipped four different heights (h-8, h-9, h-10, h-11)
 * across the controls a page can put on one line, so any row mixing two of
 * them was crooked and the page author had no way to know which pair was safe.
 *
 * One scale, three steps: sm is h-9, default is h-10, lg is h-12. A control
 * that needs a height uses one of them, and a name means the same height
 * whichever control carries it.
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { NativeSelect } from "@/core/components/ui/native-select";

/** The `h-*` step a control draws itself at. */
function height(ui: React.ReactElement, selector: string): string {
    const { container } = render(ui);
    const el = container.querySelector(selector) as HTMLElement;
    const step = el.className.split(/\s+/).find((c) => /^h-\d+$/.test(c));
    expect(step, `${selector} declares no height`).toBeTruthy();
    return step as string;
}

describe("the control scale", () => {
    it("gives a text box and a button the same height, so a search row is level", () => {
        expect(height(<Input aria-label="q" />, "input")).toBe(
            height(<Button>Go</Button>, "button"),
        );
    });

    it("gives a dropdown the same height as the box beside it", () => {
        expect(height(<NativeSelect aria-label="s"><option>a</option></NativeSelect>, "select")).toBe(
            height(<Input aria-label="q" />, "input"),
        );
    });

    it("means the same thing by sm wherever sm is written", () => {
        expect(height(<Button size="sm">Go</Button>, "button")).toBe(
            height(<NativeSelect inputSize="sm" aria-label="s"><option>a</option></NativeSelect>, "select"),
        );
    });

    it("has three steps and they are these", () => {
        expect(height(<Button size="sm">Go</Button>, "button")).toBe("h-9");
        expect(height(<Button>Go</Button>, "button")).toBe("h-10");
        expect(height(<Button size="lg">Go</Button>, "button")).toBe("h-12");
    });
});

describe("the controls core ships", () => {
    /** Everything a page can put on a row with something else. */
    const CONTROLS = ["button.tsx", "input.tsx", "native-select.tsx", "select.tsx", "icon-picker.tsx", "password-input.tsx"];

    it("invents no fourth step", () => {
        const offScale: string[] = [];
        for (const file of CONTROLS) {
            const source = fs.readFileSync(path.join(process.cwd(), "src/core/components/ui", file), "utf8");
            // Paired with a width it is an icon, not a control's own height,
            // and h-3.5 is a tick mark rather than a third-of-a-step.
            for (const match of source.matchAll(/(?<!\bw-\d{1,2}\s)\bh-(\d+)(?![.\d])(?!\s+w-)/g)) {
                if (!["9", "10", "12"].includes(match[1])) offScale.push(`${file}: h-${match[1]}`);
            }
        }
        expect(offScale).toEqual([]);
    });
});
