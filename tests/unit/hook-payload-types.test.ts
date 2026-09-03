import { describe, it, expect, beforeEach } from "vitest";
import { addAction, doAction, applyFilters, addFilter, resetHooks } from "@/core/lib/hooks";
import type { HookHandlerFor } from "@/core/lib/hooks";

/**
 * A filter that declares both halves of its contract, the way the payment
 * hooks do. Declared here rather than borrowed from an installed module so the
 * registry can be tested without one.
 */
declare global {
    interface UxwVendFilterPayloads {
        "test.ctx.chain": string;
    }
    interface UxwVendFilterContexts {
        "test.ctx.chain": { locale: string };
    }
}

/**
 * Compile-time tests. Every `@ts-expect-error` below fails `npm run typecheck`
 * if the mistake it describes ever stops being an error - which is the only way
 * to prove the payload registry is still wired up. The runtime assertions just
 * keep vitest honest about the file executing.
 */
describe("hook payload registry", () => {
    beforeEach(() => resetHooks());

    it("types the payload of a declared action", () => {
        let seen = "";
        // `payload` is typed from UxwVendHookPayloads - no annotation here.
        addAction("user.registered", (payload) => {
            seen = payload.username;
        });
        doAction("user.registered", { userId: "u1", email: "a@b.c", username: "ada" });
        expect(seen).toBe("ada");
    });

    it("rejects a payload that does not match the declaration", () => {
        // @ts-expect-error - `username` is required and `nope` is not declared
        doAction("user.registered", { userId: "u1", email: "a@b.c", nope: 1 });
        // @ts-expect-error - reading a field the declaration does not have
        addAction("user.registered", (payload) => payload.doesNotExist);
        expect(true).toBe(true);
    });

    it("leaves undeclared hook names open", () => {
        let got: unknown;
        // Nothing has claimed "some.module.event": any payload is accepted and
        // the listener sees `unknown` unless it annotates.
        addAction("some.module.event", (payload: { anything: number }) => {
            got = payload.anything;
        });
        doAction("some.module.event", { anything: 42 });
        expect(got).toBe(42);
    });

    it("types declared filters and infers undeclared ones", () => {
        addFilter("page.title", (title) => `${title} | Site`);
        const titled = applyFilters("page.title", "Home");
        expect(titled).toBe("Home | Site");

        // @ts-expect-error - "page.title" is declared as string
        applyFilters("page.title", 123);

        // Undeclared name: the value type comes from the argument.
        const n: number = applyFilters("ad.hoc.chain", 5);
        expect(n).toBe(5);
    });

    it("types the context of a filter that declares one", () => {
        addFilter("test.ctx.chain", (value: string, context?: { locale: string }) =>
            `${value}:${context?.locale ?? "none"}`,
        );

        expect(applyFilters("test.ctx.chain", "hi", { locale: "tr" })).toBe("hi:tr");

        // @ts-expect-error - the context is not optional once it is declared
        applyFilters("test.ctx.chain", "hi");
        // @ts-expect-error - and it has to be the declared shape
        applyFilters("test.ctx.chain", "hi", { locale: 5 });

        // A manifest handler gets the context typed, with no cast: this used to
        // be `unknown`, so every listener read it through one and nothing
        // checked the cast.
        const handler: HookHandlerFor<"test.ctx.chain", "filter"> = (value, context) =>
            `${value}:${context.locale}`;
        expect(handler("x", { locale: "en" })).toBe("x:en");
    });

    it("leaves the context of an undeclared filter optional and unknown", () => {
        // No entry in UxwVendFilterContexts: passing one is still allowed, and
        // omitting it still compiles.
        expect(applyFilters("ad.hoc.chain", 5, { anything: true })).toBe(5);
    });
});
