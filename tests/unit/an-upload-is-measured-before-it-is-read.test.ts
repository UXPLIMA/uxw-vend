import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A route learns how big an upload is before it reads it.
 *
 * `/api/v1/upload` handed the whole request body to `Buffer.from(await
 * blob.arrayBuffer())` and only then called `uploadFile`, which is where the
 * fifty megabyte limit lives. So the limit was enforced against a buffer the
 * server had already allocated: the one thing the limit exists to prevent had
 * already happened by the time it was checked.
 *
 * Every other upload route on this site - a module, a theme, a module update
 * pulled from a URL - reads `file.size` or the Content-Length first and
 * answers 413 without touching the body. This one now does too.
 *
 * The early check is on what the client claims. It is not a replacement for
 * what storage.ts does afterwards, which reads the file's magic bytes,
 * measures a decoded image and refuses a decompression bomb. Both stay.
 */

const ROOT = path.resolve(__dirname, "../..");

function routes(dir: string, into: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) routes(full, into);
        else if (entry.name === "route.ts") into.push(full);
    }
    return into;
}

const BUFFERING = routes(path.join(ROOT, "src/app/api")).filter((file) =>
    fs.readFileSync(file, "utf8").includes("arrayBuffer()"),
);

describe("a route that buffers an upload", () => {
    it("finds the routes that do", () => {
        expect(BUFFERING.length).toBeGreaterThan(4);
    });

    it("measures it first", () => {
        const unmeasured: string[] = [];
        for (const file of BUFFERING) {
            const source = fs.readFileSync(file, "utf8");
            const reads = source.indexOf("arrayBuffer()");
            const before = source.slice(0, reads);
            // Either the size the client declared, or the header carrying it.
            if (!/\.size\s*>|content-length|contentLength/i.test(before)) {
                unmeasured.push(path.relative(ROOT, file));
            }
        }
        expect(unmeasured).toEqual([]);
    });

    it("refuses it rather than carrying on", () => {
        for (const file of BUFFERING) {
            const source = fs.readFileSync(file, "utf8");
            // A route answering one request says 413. The bulk installer
            // answers a list, so it records the failure against that entry
            // and moves to the next id.
            expect(source, path.relative(ROOT, file)).toMatch(/413|status: "failed", error: "Too large"/);
        }
    });
});

describe("the generic upload endpoint", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/app/api/v1/upload/route.ts"), "utf8");
    const storage = fs.readFileSync(path.join(ROOT, "src/core/lib/storage.ts"), "utf8");

    it("uses storage's own limits rather than a second copy of them", () => {
        expect(source).toContain("UPLOAD_MAX_SIZE");
        expect(source).toContain("UPLOAD_ALLOWED_MIME");
        expect(storage).toContain("export const UPLOAD_MAX_SIZE");
        expect(storage).toContain("export const UPLOAD_ALLOWED_MIME");
    });

    it("still lets storage check the bytes themselves", () => {
        // A declared content type is what the client says it sent.
        expect(storage).toMatch(/detected|magic|fileTypeFrom/i);
        expect(source).toContain("uploadFile(buffer");
    });

    it("keeps the admin check and the rate limit in front of all of it", () => {
        const measured = source.indexOf(".size >");
        expect(source.indexOf("isAdmin"), "admin check").toBeGreaterThan(-1);
        expect(source.indexOf("isAdmin")).toBeLessThan(measured);
        expect(source.indexOf("rateLimit(")).toBeLessThan(measured);
    });
});
