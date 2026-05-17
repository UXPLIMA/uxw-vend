import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    addAction,
    doAction,
    doActionAsync,
    addFilter,
    applyFilters,
    applyFiltersAsync,
    removeAction,
    removeFilter,
    removeModuleHooks,
    listActions,
    listFilters,
    hasAction,
    hasFilter,
    resetHooks,
} from "@/core/lib/hooks";

describe("hooks: actions", () => {
    beforeEach(() => resetHooks());

    it("doAction calls all listeners in priority order", () => {
        const log: number[] = [];
        addAction("test", () => log.push(2), { priority: 20 });
        addAction("test", () => log.push(1), { priority: 10 });
        addAction("test", () => log.push(3), { priority: 30 });
        doAction("test", null);
        expect(log).toEqual([1, 2, 3]);
    });

    it("doAction passes payload to listener", () => {
        let received: unknown = null;
        addAction("test", (payload) => { received = payload; });
        doAction("test", { foo: "bar" });
        expect(received).toEqual({ foo: "bar" });
    });

    it("doAction is no-op for unknown hook", () => {
        expect(() => doAction("nope", null)).not.toThrow();
    });

    it("doAction continues if a listener throws", () => {
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const log: string[] = [];
        addAction("test", () => { throw new Error("boom"); });
        addAction("test", () => log.push("ran"));
        doAction("test", null);
        expect(log).toEqual(["ran"]);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it("removeAction removes a listener", () => {
        const fn = () => {};
        addAction("test", fn);
        expect(hasAction("test")).toBe(true);
        removeAction("test", fn);
        expect(hasAction("test")).toBe(false);
    });

    it("doActionAsync awaits listeners in order", async () => {
        const log: number[] = [];
        addAction("test", async () => {
            await new Promise((r) => setTimeout(r, 5));
            log.push(1);
        });
        addAction("test", () => { log.push(2); });
        await doActionAsync("test", null);
        expect(log).toEqual([1, 2]);
    });
});

describe("hooks: filters", () => {
    beforeEach(() => resetHooks());

    it("applyFilters chains transformations", () => {
        addFilter<number>("test", (v) => v + 1);
        addFilter<number>("test", (v) => v * 2);
        // Default priority same → insertion order; first +1 then *2
        const result = applyFilters("test", 5);
        expect(result).toBe(12);
    });

    it("applyFilters returns input unchanged when no listeners", () => {
        const r = applyFilters("nope", "hello");
        expect(r).toBe("hello");
    });

    it("applyFilters keeps previous value when a listener throws", () => {
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        addFilter<number>("test", (v) => v + 1);
        addFilter<number>("test", () => { throw new Error("boom"); });
        addFilter<number>("test", (v) => v * 2);
        const r = applyFilters("test", 5);
        // 5+1=6, throw → keeps 6, *2 → 12
        expect(r).toBe(12);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it("removeFilter removes a listener", () => {
        const fn = (v: number) => v;
        addFilter("test", fn);
        expect(hasFilter("test")).toBe(true);
        removeFilter("test", fn);
        expect(hasFilter("test")).toBe(false);
    });

    it("applyFiltersAsync supports async listeners", async () => {
        addFilter<number>("test", async (v) => {
            await new Promise((r) => setTimeout(r, 5));
            return v + 10;
        });
        const r = await applyFiltersAsync("test", 5);
        expect(r).toBe(15);
    });
});

describe("hooks: per-module cleanup", () => {
    beforeEach(() => resetHooks());

    it("removeModuleHooks removes all listeners from a module", () => {
        addAction("a", () => {}, { moduleId: "mod1" });
        addAction("b", () => {}, { moduleId: "mod1" });
        addAction("c", () => {}, { moduleId: "mod2" });
        addFilter("d", (v) => v, { moduleId: "mod1" });

        expect(listActions().length).toBe(3);
        expect(listFilters().length).toBe(1);

        removeModuleHooks("mod1");

        expect(listActions().length).toBe(1);
        expect(listActions()[0].name).toBe("c");
        expect(listFilters().length).toBe(0);
    });
});

describe("hooks: introspection", () => {
    beforeEach(() => resetHooks());

    it("listActions reports module names", () => {
        addAction("test", () => {}, { moduleId: "mod1" });
        addAction("test", () => {}, { moduleId: "mod2" });
        const actions = listActions();
        expect(actions[0].count).toBe(2);
        expect(actions[0].modules).toContain("mod1");
        expect(actions[0].modules).toContain("mod2");
    });
});
