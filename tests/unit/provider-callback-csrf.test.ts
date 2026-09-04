import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "../..");

/**
 * No payment could ever settle.
 *
 * The proxy runs a same-origin CSRF check over every `/api/` request, with
 * three literal exemptions: `/api/auth/`, `/api/v1/webhook/` and
 * `/api/webhook/`. Those match core's own routes and nothing else.
 *
 * A payment gateway is a module, and it ships its callback at whatever path
 * its manifest declares - `/api/v1/mollie/webhook`, `/api/v1/webhooks/stripe`,
 * `/api/v1/paytr/callback`. None of them start with the exempt prefixes, and
 * Stripe's is `/webhooks/` where the gate says `/webhook/`. A payment provider
 * posts server to server, so it sends no Origin and no Referer, which is
 * exactly the shape `checkCsrf` rejects: every one of the twelve gateways was
 * answered 403 before its handler ran. Verified against the running demo,
 * which returned `{"code":"csrf_rejected"}` for all of them.
 *
 * Core cannot know a module's callback paths, so the module declares them.
 */

interface ApiEntry {
    path: string;
    handler: string;
    method?: string;
    providerCallback?: boolean;
}

const modules = fs.readdirSync(path.join(root, "module-sources"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(root, "module-sources", name, "module.json")))
    .map((name) => ({
        name,
        manifest: JSON.parse(
            fs.readFileSync(path.join(root, "module-sources", name, "module.json"), "utf8"),
        ) as { api?: ApiEntry[] },
    }));

/** Paths that read as an inbound callback from an external service. */
const CALLBACK_SHAPED = /webhook|ipn|notify|callback/i;

describe("every gateway callback", () => {
    it("has modules to check", () => {
        expect(modules.length).toBeGreaterThan(50);
    });

    it("is declared as a provider callback", () => {
        const undeclared: string[] = [];
        for (const { name, manifest } of modules) {
            for (const entry of manifest.api ?? []) {
                if (!CALLBACK_SHAPED.test(entry.path)) continue;
                // A browser follows a GET redirect, and the gate lets safe
                // methods through regardless.
                if (entry.method === "GET") continue;
                // An admin screen reading its own delivery log is not a callback.
                const handler = path.join(root, "module-sources", name, entry.handler);
                if (!fs.existsSync(handler)) continue;
                const source = fs.readFileSync(handler, "utf8");
                const inbound = /timingSafeEqual|constructEvent|@provider-callback/.test(source);
                if (!inbound) continue;
                if (!entry.providerCallback) undeclared.push(`${name} ${entry.path}`);
            }
        }
        expect(undeclared).toEqual([]);
    });

    it("authenticates the request itself, since it skips the origin check", () => {
        const unverified: string[] = [];
        for (const { name, manifest } of modules) {
            for (const entry of (manifest.api ?? []).filter((e) => e.providerCallback)) {
                const handler = path.join(root, "module-sources", name, entry.handler);
                expect(fs.existsSync(handler), `${name} ${entry.path}: handler missing`).toBe(true);
                const source = fs.readFileSync(handler, "utf8");
                if (!/timingSafeEqual|constructEvent|@provider-callback/.test(source)) {
                    unverified.push(`${name} ${entry.path}`);
                }
            }
        }
        expect(unverified).toEqual([]);
    });

    it("covers all twelve payment gateways", () => {
        const declared = modules.flatMap(({ name, manifest }) =>
            (manifest.api ?? []).filter((e) => e.providerCallback).map(() => name),
        );
        expect(declared.length).toBe(12);
        expect(declared).toContain("stripe-gateway");
        expect(declared).toContain("mollie-gateway");
    });
});

describe("the proxy's CSRF gate", () => {
    const proxy = fs.readFileSync(path.join(root, "src/proxy.ts"), "utf8");

    it("reads the generated provider-callback list", () => {
        expect(proxy).toContain("import { providerCallbackRoutes }");
        expect(proxy).toContain("providerCallbackRoutes.some((route) => route.test(pathname))");
    });

    it("still guards every other API path", () => {
        expect(proxy).toContain("pathname.startsWith('/api/')");
        expect(proxy).toContain("checkCsrf(request)");
    });

    it("exempts only what it means to", () => {
        // If this list grows, the growth should be deliberate.
        const gate = proxy.slice(proxy.indexOf("// ===== CSRF gate ====="), proxy.indexOf("const moduleId ="));
        const literals = [...gate.matchAll(/!pathname\.startsWith\('([^']+)'\)/g)].map((m) => m[1]);
        expect(literals.sort()).toEqual(["/api/auth/", "/api/v1/webhook/", "/api/webhook/"]);
    });
});

describe("the registry generator", () => {
    const generator = fs.readFileSync(path.join(root, "scripts/generate-registry.ts"), "utf8");

    it("emits a pattern only for an endpoint that asked for the exemption", () => {
        expect(generator).toContain("if (api.providerCallback)");
        expect(generator).toContain("export const providerCallbackRoutes: RegExp[] = [");
    });
});

describe("the manifest schema", () => {
    it("accepts the flag", () => {
        const schema = fs.readFileSync(path.join(root, "src/core/lib/module-manifest-schema.ts"), "utf8");
        expect(schema).toContain("providerCallback: z.boolean().optional()");
    });
});
