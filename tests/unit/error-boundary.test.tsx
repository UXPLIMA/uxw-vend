import type React from "react";
import fs from "fs";
import path from "path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { ErrorBoundary } from "@/core/components/ErrorBoundary";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";

/**
 * `notFound()` and `redirect()` are thrown, not returned. A boundary that
 * catches them turns a 404 into a page the server already answered 200 for,
 * which is how every unknown URL became a soft 404.
 */

function Throws({ how }: { how: "notFound" | "redirect" | "real" }): React.ReactElement {
    if (how === "notFound") notFound();
    if (how === "redirect") redirect("/somewhere");
    throw new Error("a real failure");
}

/**
 * Both boundaries show a translated notice, which they can only do inside a
 * provider - the same one the locale layout wraps them in. Rendering them bare
 * here would be testing a tree the application never builds, so the test puts
 * the real English catalogue behind them and asserts on what it says.
 */
const MESSAGES = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages-core/en.json"), "utf8"),
);

function inLocale(children: React.ReactNode) {
    return (
        <NextIntlClientProvider locale="en" messages={MESSAGES}>
            {children}
        </NextIntlClientProvider>
    );
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))));
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("ErrorBoundary", () => {
    it("lets a notFound() signal through", () => {
        expect(() => render(inLocale(<ErrorBoundary><Throws how="notFound" /></ErrorBoundary>))).toThrow();
    });

    it("lets a redirect() signal through", () => {
        expect(() => render(inLocale(<ErrorBoundary><Throws how="redirect" /></ErrorBoundary>))).toThrow();
    });

    it("still catches a real render failure", () => {
        render(inLocale(<ErrorBoundary><Throws how="real" /></ErrorBoundary>));
        expect(screen.getByText(MESSAGES.common.error_title)).toBeTruthy();
        expect(screen.getByText(MESSAGES.common.reloadPage)).toBeTruthy();
    });
});

describe("ModuleErrorBoundary", () => {
    it("lets a notFound() signal through", () => {
        expect(() => render(inLocale(<ModuleErrorBoundary><Throws how="notFound" /></ModuleErrorBoundary>))).toThrow();
    });

    it("still catches a real render failure from a module component", () => {
        render(inLocale(<ModuleErrorBoundary componentId="store.widget"><Throws how="real" /></ModuleErrorBoundary>));
        expect(screen.getByText(MESSAGES.common.componentFailed)).toBeTruthy();
    });

    it("names the failing component to the console, not to the reader", () => {
        render(inLocale(<ModuleErrorBoundary componentId="store.widget"><Throws how="real" /></ModuleErrorBoundary>));
        expect(screen.queryByText(/store\.widget/)).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining("store.widget"),
            expect.anything(),
            expect.anything(),
        );
    });
});

/**
 * The file-based boundaries. `[locale]/layout.tsx` is this app's root layout,
 * and a boundary never catches its own segment's layout, so a failure there
 * lands on `global-error.tsx` or on Next's built-in screen if there is none.
 */
describe("the route error pages", () => {
    const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

    it("ships a global-error page that supplies its own document", () => {
        const source = read("src/app/global-error.tsx");
        expect(source).toContain("<html");
        expect(source).toContain("<body");
        expect(source).toContain("reset()");
    });

    it("never prints an error message to a visitor outside development", () => {
        for (const file of ["src/app/error.tsx", "src/app/global-error.tsx", "src/app/[locale]/error.tsx"]) {
            const source = read(file);
            for (const [index, line] of source.split("\n").entries()) {
                if (!line.includes("error.message")) continue;
                // The only allowed use is inside the development-only block,
                // which opens on the line above it.
                const guarded = source
                    .split("\n")
                    .slice(Math.max(0, index - 6), index)
                    .some((prior) => prior.includes('NODE_ENV === "development"'));
                expect(guarded, `${file}:${index + 1} prints error.message unguarded`).toBe(true);
            }
        }
    });
});
