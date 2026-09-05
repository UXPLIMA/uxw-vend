import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { exportedHttpMethods, allowHeader, HTTP_METHODS } from "@/core/lib/http-methods";
import { matchApiRoute } from "@/core/lib/api-matcher";
import { ModuleApiRoutes } from "@/core/generated/module-registry";

/**
 * What a module endpoint says it accepts, and what it accepts.
 *
 * Every module endpoint is served by one dispatcher, `/api/v1/[...path]`,
 * which has to export all five verbs to be reachable by any of them. Next
 * builds the `Allow` header from a route file's exports, so every module
 * endpoint reported all seven methods no matter what its handler did.
 * Measured on the demo before the fix:
 *
 *     OPTIONS /api/v1/leaderboard         -> Allow: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
 *     OPTIONS /api/v1/announcements/xyz   -> Allow: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
 *     GET     /api/v1/announcements/xyz   -> 405, no Allow header
 *
 * `/api/v1/leaderboard` exports GET. `/api/v1/announcements/[id]` exports
 * PATCH and DELETE, so the two verbs the header led with were the two it
 * rejects. RFC 9110 requires a 405 to carry `Allow`, and this one carried
 * none, so a client that got the 405 had nowhere to look.
 *
 * The verbs are collected into the route table at registry-generation time.
 * The dispatcher answers OPTIONS itself and puts `Allow` on both of its 405s,
 * and the second of those - the one raised after the handler is imported -
 * reads the module's own exports, which is the last word if the two disagree.
 */

const ROOT = process.cwd();

describe("exportedHttpMethods", () => {
    it("finds a handler written as a function", () => {
        expect(exportedHttpMethods("export async function GET() {}\nexport async function DELETE() {}")).toEqual([
            "GET",
            "DELETE",
        ]);
    });

    it("finds the destructured re-export Auth.js uses", () => {
        expect(exportedHttpMethods("export const { GET, POST } = handlers;")).toEqual(["GET", "POST"]);
    });

    it("is not fooled by a word that merely contains a verb", () => {
        expect(exportedHttpMethods("export async function GETTER() {}")).toEqual([]);
        expect(exportedHttpMethods("const GET = 1;")).toEqual([]);
        expect(exportedHttpMethods("// export async function POST")).toEqual(["POST"]); // a comment still reads as one
    });

    it("returns them in one fixed order whatever order they were written", () => {
        expect(exportedHttpMethods("export async function DELETE(){}\nexport async function GET(){}")).toEqual([
            "GET",
            "DELETE",
        ]);
    });
});

describe("allowHeader", () => {
    it("writes the list the way Next writes it", () => {
        expect(allowHeader(["GET"])).toBe("GET, HEAD, OPTIONS");
        expect(allowHeader(["PATCH", "DELETE"])).toBe("DELETE, OPTIONS, PATCH");
        expect(allowHeader(HTTP_METHODS)).toBe("DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT");
    });

    it("offers HEAD only where GET is offered", () => {
        expect(allowHeader(["POST"])).toBe("OPTIONS, POST");
        expect(allowHeader([])).toBe("OPTIONS");
    });
});

describe("the generated route table", () => {
    it("has routes to check", () => {
        expect(ModuleApiRoutes.length).toBeGreaterThan(50);
    });

    it("records the verbs every installed handler exports", () => {
        const wrong: string[] = [];
        for (const route of ModuleApiRoutes) {
            const file = path.join(ROOT, "src/modules", route.module, route.handler);
            if (!fs.existsSync(file)) continue;
            const real = exportedHttpMethods(fs.readFileSync(file, "utf8"));
            const recorded = route.methods ?? [];
            if (real.join(",") !== recorded.join(",")) {
                wrong.push(`${route.path}: table says ${recorded.join("|") || "nothing"}, ${route.handler} exports ${real.join("|")}`);
            }
        }
        expect(wrong).toEqual([]);
    });

    it("records something for every route whose handler is on disk", () => {
        const blank = ModuleApiRoutes.filter((r) => {
            const file = path.join(ROOT, "src/modules", r.module, r.handler);
            return fs.existsSync(file) && (r.methods ?? []).length === 0;
        }).map((r) => r.path);
        expect(blank).toEqual([]);
    });

    it("carries the verbs through the matcher", () => {
        const match = matchApiRoute(["announcements", "some-id"]);
        expect(match).not.toBeNull();
        expect(match!.methods).toEqual(["PATCH", "DELETE"]);
        expect(allowHeader(match!.methods!)).toBe("DELETE, OPTIONS, PATCH");
    });

    it("carries them for a concrete path too, not only a pattern", () => {
        const match = matchApiRoute(["leaderboard"]);
        expect(match?.methods).toEqual(["GET"]);
    });

    it("names the endpoints whose header used to be a lie", () => {
        // Both of these advertised all seven verbs.
        const readOnly = ModuleApiRoutes.filter((r) => (r.methods ?? []).join(",") === "GET");
        expect(readOnly.length).toBeGreaterThan(5);
        const writeOnly = ModuleApiRoutes.filter((r) => (r.methods ?? []).length > 0 && !(r.methods ?? []).includes("GET"));
        expect(writeOnly.length).toBeGreaterThan(5);
    });
});

describe("the dispatcher", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/app/api/v1/[...path]/route.ts"), "utf8");

    it("answers OPTIONS itself rather than letting Next list all five", () => {
        expect(source).toMatch(/export async function OPTIONS/);
    });

    it("puts an Allow on both of its 405s", () => {
        // One before the handler is loaded, one after; neither had a header.
        expect(source.match(/methodNotAllowed\(/g)?.length).toBe(3); // two calls + the definition
        expect(source).not.toMatch(/\{ error: `Method \$\{method\} not allowed` \}, \{ status: 405 \}/);
    });

    it("prefers the loaded module's own exports for the later 405", () => {
        expect(source).toContain("Object.keys(handlerModule)");
    });

    it("lets a manifest method narrow the set but not widen it", () => {
        const fn = source.slice(source.indexOf("function allowedMethods"), source.indexOf("const VERBS"));
        expect(fn).toContain('match.method !== "ALL"');
        expect(fn).toContain("exported.filter");
    });

    it("says nothing rather than guessing when it knows no verbs", () => {
        const fn = source.slice(source.indexOf("function methodNotAllowed"));
        expect(fn.slice(0, 500)).toContain("allowed.length > 0");
    });
});

describe("allowedMethods, reconstructed", () => {
    // The dispatcher's rule, restated: the intersection of what the handler
    // exports and what the manifest permits.
    const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    const allowedMethods = (match: { method?: string; methods?: string[] }, exports?: string[]) => {
        const source = exports ?? match.methods ?? [];
        const exported = source.map((m) => m.toUpperCase()).filter((m) => VERBS.includes(m));
        if (match.method && match.method !== "ALL") {
            const declared = match.method.toUpperCase();
            return exported.length > 0 ? exported.filter((m) => m === declared) : [declared];
        }
        return exported;
    };

    it("takes the handler's verbs when the manifest declares none", () => {
        expect(allowedMethods({ method: "ALL", methods: ["PATCH", "DELETE"] })).toEqual(["PATCH", "DELETE"]);
    });

    it("narrows to the one verb a manifest declared", () => {
        expect(allowedMethods({ method: "POST", methods: ["GET", "POST"] })).toEqual(["POST"]);
    });

    it("does not let a manifest claim a verb the handler has not got", () => {
        expect(allowedMethods({ method: "POST", methods: ["GET"] })).toEqual([]);
    });

    it("falls back to the manifest when the table knows nothing", () => {
        expect(allowedMethods({ method: "POST" })).toEqual(["POST"]);
        expect(allowedMethods({ method: "ALL" })).toEqual([]);
    });

    it("ignores anything in the exports that is not a verb", () => {
        expect(allowedMethods({ method: "ALL" }, ["GET", "dynamic", "runtime", "default"])).toEqual(["GET"]);
    });
});
