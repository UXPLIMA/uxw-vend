import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const KEYS = [
    "AUTH_URL",
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SITE_URL",
    "SITE_NAME",
    "NEXT_PUBLIC_APP_NAME",
] as const;

let saved: Record<string, string | undefined> = {};

// The module reads process.env at call time, not import time, so a plain
// re-import is enough - no module registry reset needed.
async function load() {
    return await import("@/core/lib/app-url");
}

beforeEach(() => {
    saved = {};
    for (const k of KEYS) {
        saved[k] = process.env[k];
        delete process.env[k];
    }
});

afterEach(() => {
    for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
});

describe("resolveAppUrl", () => {
    it("prefers AUTH_URL over every other source", async () => {
        process.env.AUTH_URL = "https://shop.example.com";
        process.env.NEXTAUTH_URL = "https://old.example.com";
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
        const { resolveAppUrl } = await load();
        expect(resolveAppUrl()).toBe("https://shop.example.com");
    });

    it("falls back through NEXTAUTH_URL, then the public vars", async () => {
        const { resolveAppUrl } = await load();

        process.env.NEXTAUTH_URL = "https://a.example.com";
        expect(resolveAppUrl()).toBe("https://a.example.com");

        delete process.env.NEXTAUTH_URL;
        process.env.NEXT_PUBLIC_APP_URL = "https://b.example.com";
        expect(resolveAppUrl()).toBe("https://b.example.com");

        delete process.env.NEXT_PUBLIC_APP_URL;
        process.env.NEXT_PUBLIC_SITE_URL = "https://c.example.com";
        expect(resolveAppUrl()).toBe("https://c.example.com");
    });

    it("strips trailing slashes so callers can concatenate paths", async () => {
        process.env.AUTH_URL = "https://shop.example.com///";
        const { resolveAppUrl } = await load();
        expect(resolveAppUrl()).toBe("https://shop.example.com");
    });

    it("skips a malformed value instead of emitting it as a canonical URL", async () => {
        process.env.AUTH_URL = "not a url";
        process.env.NEXTAUTH_URL = "https://good.example.com";
        const { resolveAppUrl } = await load();
        expect(resolveAppUrl()).toBe("https://good.example.com");
    });

    it("rejects a non-http(s) scheme", async () => {
        process.env.AUTH_URL = "javascript:alert(1)";
        const { resolveAppUrl } = await load();
        expect(resolveAppUrl()).toBe("http://localhost:3001");
    });

    it("falls back to localhost when nothing is set", async () => {
        const { resolveAppUrl } = await load();
        expect(resolveAppUrl()).toBe("http://localhost:3001");
    });
});

describe("routes that publish the canonical URL", () => {
    // robots.ts and sitemap.ts are the only two routes Next prerenders at
    // BUILD time (everything else is dynamic because of the [locale] segment).
    // A prerendered route bakes in whatever AUTH_URL CI had, so every
    // installation would publish `http://localhost:3001`. Touching a
    // request-time API opts them out of that. If someone drops the
    // `connection()` call, this test is the only thing that will notice -
    // the build still succeeds and the wrong host only shows up in production.
    const read = (rel: string) =>
        fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

    it.each(["src/app/robots.ts", "src/app/sitemap.ts"])(
        "%s opts out of build-time prerendering",
        (file) => {
            const src = read(file);
            expect(src).toMatch(/from ["']next\/server["']/);
            expect(src).toMatch(/await connection\(\)/);
            expect(src).toContain("resolveAppUrl");
        },
    );

    it("sitemap.ts no longer claims an ISR window it cannot honour", () => {
        // `revalidate` and a request-time API are mutually exclusive; leaving
        // the export would be a lie about how the route behaves.
        expect(read("src/app/sitemap.ts")).not.toMatch(/^export const revalidate/m);
    });
});

describe("resolveAppName", () => {
    it("prefers the runtime SITE_NAME over the build-time public var", async () => {
        process.env.SITE_NAME = "Acme Store";
        process.env.NEXT_PUBLIC_APP_NAME = "Baked In At Build Time";
        const { resolveAppName } = await load();
        expect(resolveAppName()).toBe("Acme Store");
    });

    it("defaults to uxwVend", async () => {
        const { resolveAppName } = await load();
        expect(resolveAppName()).toBe("uxwVend");
    });
});
