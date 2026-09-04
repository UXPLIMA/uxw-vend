import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { providerCallbackRoutes } from "@/core/generated/module-routes";

/**
 * The proxy runs a same-origin check on every `/api/` request. A payment
 * provider posting a webhook has no browser and sends no Origin, so a module
 * marks that endpoint `providerCallback` and core generates a regex the proxy
 * tests the path against. Anything the regex matches skips the check.
 *
 * The regex used to be built the same way as the module route map, which is a
 * prefix match ending in `(?:\/|$)`. That is right for "this subtree belongs to
 * this module" and wrong for "this path needs no origin check". A callback
 * declared at `/[provider]` produced `/^\/api\/v1\/[^\/]+(?:\/|$)/`, which
 * matches `/api/v1/users/me`, `/api/v1/roles`, `/api/v1/settings` and every
 * other route in the product; `/[...path]` matched all of them too. One entry
 * in one manifest turned the CSRF gate off for the whole API, and the existing
 * check on these declarations only looked at whether the handler verified a
 * signature, never at how much the exemption covered.
 *
 * Modules install from ZIPs, so the manifest is a trust boundary. Two things
 * hold the blast radius down now: the generated regex is anchored to the end of
 * the declared path, and `validate-module` refuses a callback whose first
 * segment is dynamic. This checks the property both of them exist for.
 */

const ROOT = path.resolve(__dirname, "../..");
const API_DIR = path.join(ROOT, "src", "app", "api");

/** Every path core serves itself, as the proxy would see it. */
function coreApiPaths(dir: string, prefix = "/api"): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        // A dynamic segment stands in for a plausible concrete value.
        const segment = /^\[\.\.\..+\]$/.test(entry.name)
            ? "anything/deeper"
            : /^\[.+\]$/.test(entry.name)
              ? "some-id"
              : entry.name;
        const full = path.join(dir, entry.name);
        const routePath = `${prefix}/${segment}`;
        if (fs.existsSync(path.join(full, "route.ts"))) out.push(routePath);
        out.push(...coreApiPaths(full, routePath));
    }
    return out;
}

const CORE_PATHS = coreApiPaths(API_DIR);

describe("the CSRF exemption list", () => {
    it("finds core's API routes and at least one exempt module endpoint", () => {
        expect(CORE_PATHS.length).toBeGreaterThan(50);
        expect(providerCallbackRoutes.length).toBeGreaterThan(0);
    });

    it("exempts no route core serves itself", () => {
        const exempted = CORE_PATHS.filter((p) => providerCallbackRoutes.some((re) => re.test(p)));
        expect(exempted).toEqual([]);
    });

    it("anchors every exemption to the end of its own path", () => {
        // An unanchored pattern is what let one endpoint speak for a subtree.
        const unanchored = providerCallbackRoutes.filter((re) => !re.source.endsWith("$"));
        expect(unanchored.map((re) => re.source)).toEqual([]);
    });

    it("exempts nothing one path segment deeper than it was declared for", () => {
        for (const re of providerCallbackRoutes) {
            // Reconstruct a path the pattern accepts, then walk one past it.
            const literal = re.source
                .replace(/^\^/, "")
                .replace(/\\\/\?\$$/, "")
                .replace(/\\\//g, "/")
                .replace(/\[\^\/\]\+/g, "x")
                .replace(/\.\+/g, "x");
            expect(re.test(literal), `${re.source} should match its own path`).toBe(true);
            expect(re.test(`${literal}/deeper`), `${re.source} must not cover a subtree`).toBe(false);
        }
    });
});

describe("the declarations behind it", () => {
    const manifests = fs
        .readdirSync(path.join(ROOT, "module-sources"), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(ROOT, "module-sources", e.name, "module.json"))
        .filter((f) => fs.existsSync(f))
        .map((f) => ({ file: f, manifest: JSON.parse(fs.readFileSync(f, "utf8")) as {
            id: string;
            api?: { path: string; providerCallback?: boolean }[];
        } }));

    it("reads the module manifests", () => {
        expect(manifests.length).toBeGreaterThan(50);
    });

    it("gives every provider callback a literal first segment", () => {
        const offenders: string[] = [];
        for (const { manifest } of manifests) {
            for (const entry of manifest.api ?? []) {
                if (entry.providerCallback && /^\/?\[/.test(entry.path)) {
                    offenders.push(`${manifest.id}: ${entry.path}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
