// @vitest-environment node
import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

/**
 * The API docs page carries a looser policy, and never received it.
 *
 * `next.config.ts` builds two header rules: one for
 * `/:locale/admin/api-docs/:path*` carrying a CSP with `unsafe-eval`, because
 * the Swagger bundle eval()s its own spec loader, and one for `/(.*)` carrying
 * the site policy, which drops `unsafe-eval` in production on purpose. The
 * exception was listed first and the catch-all second.
 *
 * Next applies every rule whose source matches and lets a later one win on a
 * key it repeats. Measured against a production build: `/en/admin/api-docs`
 * and `/en` came back with byte-identical policies, 489 characters each,
 * neither containing `unsafe-eval`. The exception had been overwritten by the
 * rule it existed to except, so the one page that needs eval was the one page
 * that could not have it.
 *
 * Order is the whole fix: the general rule goes first and the exception after.
 */

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

async function rules(): Promise<HeaderRule[]> {
    const headers = nextConfig.headers;
    if (!headers) throw new Error("next.config declares no headers()");
    return (await headers()) as HeaderRule[];
}

function cspOf(rule: HeaderRule): string {
    return rule.headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
}

describe("the header rules", () => {
    it("still carry a catch-all and an api-docs exception", async () => {
        const sources = (await rules()).map((r) => r.source);
        expect(sources).toContain("/(.*)");
        expect(sources.some((s) => s.includes("api-docs"))).toBe(true);
    });

    it("puts the exception after the rule it excepts, so it survives", async () => {
        const sources = (await rules()).map((r) => r.source);
        const catchAll = sources.indexOf("/(.*)");
        const exception = sources.findIndex((s) => s.includes("api-docs"));
        expect(
            exception,
            "a rule listed before the catch-all is overwritten by it",
        ).toBeGreaterThan(catchAll);
    });

    it("gives the api-docs rule the eval its bundle needs", async () => {
        const rule = (await rules()).find((r) => r.source.includes("api-docs"));
        expect(rule, "api-docs rule missing").toBeTruthy();
        expect(cspOf(rule as HeaderRule)).toContain("'unsafe-eval'");
    });

    it("keeps eval out of the policy every other page gets", async () => {
        const rule = (await rules()).find((r) => r.source === "/(.*)");
        expect(rule).toBeTruthy();
        // The dev server adds it back for React's development build; a test
        // process is not dev, so this is the production shape.
        expect(cspOf(rule as HeaderRule)).not.toContain("'unsafe-eval'");
    });
});
