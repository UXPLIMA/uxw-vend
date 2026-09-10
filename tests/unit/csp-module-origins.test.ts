import { describe, it, expect } from "vitest";
import { moduleCspSchema } from "@/core/lib/module-manifest-schema";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "../..");
const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");

/**
 * Core's CSP was a fixed list no module could reach.
 *
 * It named two payment gateway origins - `https://api.sandbox.paypal.com` and
 * `https://js.stripe.com` - which is core knowing about modules, and it was
 * wrong twice over. Neither gateway loads either: both are server to server,
 * and the PayPal entry was not even a frame host but the REST API's, spelled
 * differently from the one the module actually calls. Meanwhile every origin a
 * module genuinely needed was blocked. The Discord widget's iframe pointed at
 * `https://discord.com` and rendered an empty box; the Google Analytics tag
 * pulled gtag from `https://www.googletagmanager.com` and loaded nothing. A
 * blocked subresource raises no server error and no client error - only a
 * console line nobody is reading - so both had shipped that way from the
 * start.
 *
 * The module declares its origins and the policy is composed from core's own
 * sources plus whatever the installed modules asked for.
 */

interface Manifest {
    csp?: Record<string, string[]>;
}

const modules = fs
    .readdirSync(path.join(root, "module-sources"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(root, "module-sources", name, "module.json")))
    .map((name) => ({
        name,
        manifest: JSON.parse(
            fs.readFileSync(path.join(root, "module-sources", name, "module.json"), "utf8"),
        ) as Manifest,
    }));

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...sourceFiles(p));
        else if (/\.tsx?$/.test(entry.name)) out.push(p);
    }
    return out;
}

/** Frame and script origins a file loads. Those are the two a block silences. */
function externalOrigins(source: string): string[] {
    const patterns = [
        /<iframe[\s\S]{0,400}?src=\{?[`"']([^`"'{$]*https:\/\/[^`"'/]+)/g,
        /<[Ss]cript[\s\S]{0,300}?src=\{?[`"']([^`"'{$]*https:\/\/[^`"'/]+)/g,
    ];
    const found: string[] = [];
    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            try {
                found.push(new URL(match[1].replace(/^.*?(https:\/\/)/, "$1")).origin);
            } catch {
                // A template with an interpolated host is not a literal origin.
            }
        }
    }
    return found;
}

describe("core's content security policy", () => {
    it("names no module's origin", () => {
        const csp = nextConfig.slice(
            nextConfig.indexOf("const buildCsp"),
            nextConfig.indexOf("const baseCsp"),
        );
        // Core's own: the fonts its stylesheets pull, and the Cloudflare beacon.
        const allowed = new Set([
            "https://static.cloudflareinsights.com",
            "https://fonts.googleapis.com",
            "https://fonts.gstatic.com",
        ]);
        const named = [...csp.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]);
        expect(named.filter((o) => !allowed.has(o))).toEqual([]);
    });

    it("composes each fetch directive from core plus the installed modules", () => {
        expect(nextConfig).toContain("moduleCspOrigins()");
        for (const name of ["script-src", "frame-src", "connect-src", "img-src", "style-src", "font-src"]) {
            expect(nextConfig).toContain(`directive('${name}'`);
        }
    });

    it("keeps the directives a module must not touch as literals", () => {
        // Widening any of these would undo the policy for the whole site, so
        // they are not composed and there is nothing for a module to add to.
        for (const literal of [
            `"default-src 'self'"`,
            `"frame-ancestors 'self'"`,
            `"form-action 'self'"`,
            `"base-uri 'self'"`,
            `"object-src 'none'"`,
        ]) {
            expect(nextConfig).toContain(literal);
        }
    });

    it("survives a checkout that has generated no contributions", () => {
        // A fresh clone has no src/core/generated; the config must still build.
        expect(nextConfig).toContain("catch {");
        expect(nextConfig).toContain("return {};");
    });
});

describe("every module", () => {
    it("declares the external origins it loads", () => {
        const undeclared: string[] = [];
        for (const { name, manifest } of modules) {
            const declared = new Set(Object.values(manifest.csp ?? {}).flat());
            for (const file of sourceFiles(path.join(root, "module-sources", name))) {
                for (const origin of externalOrigins(fs.readFileSync(file, "utf8"))) {
                    if (!declared.has(origin)) undeclared.push(`${name}: ${origin}`);
                }
            }
        }
        expect([...new Set(undeclared)]).toEqual([]);
    });

    it("declares only concrete origins, and a socket only where one can be opened", () => {
        const HTTPS = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/;
        // A websocket is a connection, not a script or a picture, so it is a
        // shape `connect-src` may hold and no other directive may.
        const CONNECTABLE = /^(https|wss):\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/;

        const bad: string[] = [];
        for (const { name, manifest } of modules) {
            for (const [directive, origins] of Object.entries(manifest.csp ?? {})) {
                const shape = directive === "connect-src" ? CONNECTABLE : HTTPS;
                for (const origin of origins) {
                    if (!shape.test(origin)) bad.push(`${name} ${directive}: ${origin}`);
                }
            }
        }
        expect(bad).toEqual([]);
    });

    it("has the two that needed one", () => {
        const byName = new Map(modules.map((m) => [m.name, m.manifest]));
        expect(byName.get("discord-widget")?.csp?.["frame-src"]).toEqual(["https://discord.com"]);
        expect(byName.get("google-analytics")?.csp?.["script-src"]).toEqual([
            "https://www.googletagmanager.com",
        ]);
    });
});

describe("the api documentation", () => {
    it("is served from one place, not two", () => {
        // /api/docs shipped a second Swagger UI as raw HTML pulling its bundle
        // from unpkg. Core's policy allows no third-party script origin, so it
        // rendered an empty div, and the spec it asked for answers 401 to
        // anyone but an admin. The admin page renders the bundled copy.
        expect(fs.existsSync(path.join(root, "src/app/api/docs"))).toBe(false);
        expect(
            fs.existsSync(path.join(root, "src/app/[locale]/(admin)/admin/api-docs/page.tsx")),
        ).toBe(true);
    });
});

/**
 * A socket is a connection too.
 *
 * `connect-src` governs what a page may open, and for a chat widget that is a
 * websocket rather than a request: the conversation arrives down it. The
 * origin pattern only ever accepted `https://`, so a module needing one had
 * two options and both were bad - leave it out of the manifest and let the
 * policy block the socket, which is a chat bubble that appears and never
 * connects, or widen the policy by hand somewhere core cannot see.
 *
 * So `wss://` is accepted, and only where a socket can be opened. Everything
 * the pattern refused before it still refuses: a bare scheme, a wildcard, a
 * host with no dot in it, and `ws://` without the s, which would take the
 * conversation off the encrypted connection the rest of the page is on.
 */
describe("a websocket origin", () => {
    it("is accepted where a page may open a connection", () => {
        expect(moduleCspSchema.safeParse({ "connect-src": ["wss://client.relay.example.com"] }).success).toBe(true);
    });

    it("is accepted beside an https origin in the same list", () => {
        const parsed = moduleCspSchema.safeParse({
            "connect-src": ["https://client.example.com", "wss://client.relay.example.com"],
        });
        expect(parsed.success).toBe(true);
    });

    it("is refused where a script or a picture comes from", () => {
        for (const directive of ["script-src", "img-src", "style-src", "font-src", "frame-src", "media-src"]) {
            const parsed = moduleCspSchema.safeParse({ [directive]: ["wss://client.relay.example.com"] });
            expect(parsed.success, directive).toBe(false);
        }
    });

    it("is refused without the encryption", () => {
        expect(moduleCspSchema.safeParse({ "connect-src": ["ws://client.relay.example.com"] }).success).toBe(false);
    });

    it("refuses what it always refused", () => {
        for (const bad of ["wss://*", "wss:", "wss://localhost", "wss://example.com/path", "*"]) {
            expect(moduleCspSchema.safeParse({ "connect-src": [bad] }).success, bad).toBe(false);
        }
    });
});
