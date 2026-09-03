import type React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
        expect(() => render(<ErrorBoundary><Throws how="notFound" /></ErrorBoundary>)).toThrow();
    });

    it("lets a redirect() signal through", () => {
        expect(() => render(<ErrorBoundary><Throws how="redirect" /></ErrorBoundary>)).toThrow();
    });

    it("still catches a real render failure", () => {
        render(<ErrorBoundary><Throws how="real" /></ErrorBoundary>);
        expect(screen.getByText("Something went wrong")).toBeTruthy();
    });
});

describe("ModuleErrorBoundary", () => {
    it("lets a notFound() signal through", () => {
        expect(() => render(<ModuleErrorBoundary><Throws how="notFound" /></ModuleErrorBoundary>)).toThrow();
    });

    it("still catches a real render failure from a module component", () => {
        render(<ModuleErrorBoundary fallbackLabel="Widget failed"><Throws how="real" /></ModuleErrorBoundary>);
        expect(screen.getByText("Widget failed")).toBeTruthy();
    });
});
