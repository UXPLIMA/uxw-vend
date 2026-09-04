import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SEARCH_QUERY_MAX_LENGTH } from "@/core/lib/constants";

const root = path.resolve(import.meta.dirname, "../..");
const routePath = path.join(root, "src/app/api/v1/search/route.ts");
const route = fs.readFileSync(routePath, "utf8");

/**
 * `/api/v1/search` is the one public endpoint that fans out.
 *
 * It takes an anonymous query string and hands it to every enabled module's
 * search provider, and each provider spends a `plainto_tsquery` parse or an
 * ILIKE scan on it. Nothing bounded the string and nothing limited the rate,
 * so a single caller could turn one request into as many expensive queries as
 * the install has providers, at whatever rate they liked.
 */

describe("the public search endpoint", () => {
    it("bounds the query before any provider sees it", () => {
        expect(route).toContain("SEARCH_QUERY_MAX_LENGTH");
        expect(route).toContain("query_too_long");
        // The check has to precede the fan-out, not follow it.
        expect(route.indexOf("SEARCH_QUERY_MAX_LENGTH")).toBeLessThan(
            route.indexOf("enabledProviders.map"),
        );
    });

    it("is rate limited", () => {
        expect(route).toContain("withRateLimit");
        expect(route).toMatch(/export const GET = withRateLimit\(/);
    });

    it("caps at a length a person could actually type", () => {
        expect(SEARCH_QUERY_MAX_LENGTH).toBeGreaterThanOrEqual(64);
        expect(SEARCH_QUERY_MAX_LENGTH).toBeLessThanOrEqual(512);
    });

    it("is capped in the browser by the same constant", () => {
        const page = fs.readFileSync(
            path.join(root, "src/app/[locale]/(public)/search/page.tsx"),
            "utf8",
        );
        // A literal here would drift from the server's bound.
        expect(page).toContain("maxLength={SEARCH_QUERY_MAX_LENGTH}");
        expect(page).toContain('from "@/core/lib/constants"');
    });
});

/**
 * Every module search provider is reached through the same endpoint, so the
 * bound above protects all of them. What a provider must not do is widen the
 * blast radius on its own: an unbounded `take` would let one match-heavy query
 * pull the table.
 */
describe("every module search provider", () => {
    const handlers: Array<{ module: string; source: string }> = [];
    for (const mod of fs.readdirSync(path.join(root, "module-sources"))) {
        const handler = path.join(root, "module-sources", mod, "search/handler.ts");
        if (fs.existsSync(handler)) {
            handlers.push({ module: mod, source: fs.readFileSync(handler, "utf8") });
        }
    }

    it("has providers to check", () => {
        expect(handlers.length).toBeGreaterThan(0);
    });

    it("caps the rows it returns", () => {
        const unbounded = handlers
            .filter(({ source }) => !/take:\s*\d+/.test(source) || !/LIMIT \d+/.test(source))
            .map(({ module }) => module);
        expect(unbounded).toEqual([]);
    });

    it("refuses a query too short to be selective", () => {
        const permissive = handlers
            .filter(({ source }) => !/q\.length\s*<\s*[1-9]/.test(source))
            .map(({ module }) => module);
        expect(permissive).toEqual([]);
    });
});
