// @vitest-environment node
/**
 * Every gate this platform has in front of an API route - CSRF, the IP
 * blocklist, maintenance mode, the setup wizard, the module-enabled check,
 * the demo write gate - lives in src/proxy.ts. Two things decided whether the
 * proxy saw a request at all, and both took "the path contains a dot" to mean
 * "this is a file in /public":
 *
 *   - `config.matcher`, which kept the request from reaching the proxy
 *   - `isStaticAsset()`, which waved it past the gates once it had
 *
 * An API id is allowed to contain a dot. The store resolves a product with
 * `Number(id)`, so `DELETE /api/v1/store/products/1.` reached the same row as
 * `products/1` while answering from outside every gate: against the running
 * demo the dotted path returned 401 from the handler where the plain one
 * returned 403 csrf_rejected from the proxy.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { isStaticAsset } from "@/core/lib/proxy-paths";

describe("isStaticAsset", () => {
    it("never calls an API path static, dot or no dot", () => {
        expect(isStaticAsset("/api/v1/store/products/1")).toBe(false);
        expect(isStaticAsset("/api/v1/store/products/1.")).toBe(false);
        expect(isStaticAsset("/api/v1/store/products/report.json")).toBe(false);
        expect(isStaticAsset("/api/health")).toBe(false);
        expect(isStaticAsset("/api")).toBe(false);
    });

    it("still recognises build output and public files", () => {
        expect(isStaticAsset("/_next/static/chunks/main.js")).toBe(true);
        expect(isStaticAsset("/_vercel/insights/script.js")).toBe(true);
        expect(isStaticAsset("/logo.png")).toBe(true);
        expect(isStaticAsset("/uploads/avatars/3.webp")).toBe(true);
    });

    it("treats ordinary pages as gated", () => {
        expect(isStaticAsset("/")).toBe(false);
        expect(isStaticAsset("/en/store")).toBe(false);
        expect(isStaticAsset("/en/admin/settings")).toBe(false);
    });
});

/**
 * `config.matcher` has to stay a literal in src/proxy.ts - Next reads it
 * statically during the build - so it is checked at the source level.
 */
describe("proxy matcher", () => {
    const source = fs.readFileSync(
        path.resolve(import.meta.dirname, "../../src/proxy.ts"),
        "utf8",
    );
    const matcherBlock = source.slice(source.indexOf("export const config"));

    it("routes every API path through the proxy unconditionally", () => {
        expect(matcherBlock).toContain("'/api/:path*'");
    });

    it("keeps the catch-all pattern excluding dotted paths, which is why the API entry is needed", () => {
        const line = matcherBlock.split("\n").find((l) => l.includes("'/(("));
        expect(line, "the general matcher pattern moved or changed shape").toBeTruthy();
        const pattern = line!.slice(line!.indexOf("'") + 1, line!.lastIndexOf("'"));

        // The source escapes the backslash for the TS string literal; undo
        // that to get the pattern Next actually compiles.
        const asRegex = new RegExp("^" + pattern.replace(/\\\\/g, "\\") + "$");
        expect(asRegex.test("/en/store")).toBe(true);
        // A dotted path is not matched here, so without '/api/:path*' the
        // proxy would never run for it.
        expect(asRegex.test("/api/v1/store/products/1.")).toBe(false);
        expect(asRegex.test("/logo.png")).toBe(false);
    });
});
