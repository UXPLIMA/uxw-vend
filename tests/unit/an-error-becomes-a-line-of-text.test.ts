import { describe, it, expect } from "vitest";
import { errorText } from "@/core/lib/logger";

/**
 * What a log line says an error was.
 *
 * Every catch wrote `err instanceof Error ? err.message : String(err)` for
 * itself: thirty five of them in core alone. Each was a branch, and no test
 * ever threw anything but an Error, so half of every one of them went
 * uncovered. Three files fell under their coverage floor because of it, and
 * the floor was right to complain: nobody knew what those endpoints logged
 * when something threw a string.
 *
 * One branch, in one place, taken both ways here.
 */
describe("what a log line says an error was", () => {
    it("is the message, when something threw an Error", () => {
        expect(errorText(new Error("connection refused"))).toBe("connection refused");
    });

    it("is the value itself, when something threw anything else", () => {
        expect(errorText("ECONNRESET")).toBe("ECONNRESET");
        expect(errorText(404)).toBe("404");
    });

    it("says so rather than nothing, when something threw nothing", () => {
        expect(errorText(undefined)).toBe("undefined");
        expect(errorText(null)).toBe("null");
    });

    it("keeps the name of a subclass's message", () => {
        class TimeoutError extends Error {}
        expect(errorText(new TimeoutError("took too long"))).toBe("took too long");
    });
});
