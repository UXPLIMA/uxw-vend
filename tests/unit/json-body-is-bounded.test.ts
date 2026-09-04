import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { readJsonBody, MAX_JSON_BODY_BYTES } from "../../src/core/lib/api-body";

/**
 * App Router route handlers have no request body limit. The 1 MB that Pages
 * API routes shipped with does not apply, and nothing else in the stack
 * supplies one, so every JSON endpoint accepted a body of any size and
 * buffered it whole before its own validation could refuse a single field.
 * An 8 MB registration body was parsed and answered by the live demo in
 * 140 ms; the request was ordinary in every way except its size.
 *
 * `readJsonBody` now reads the body as a stream and abandons it the moment it
 * passes the cap, so an oversized request costs the cap and no more. These
 * tests hold that behaviour, and hold the routes on the helper: a bare
 * `request.json()` reads whatever it is given, so the cap is only real while
 * every route goes through the one door.
 */

const ROOT = path.resolve(__dirname, "../..");

function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
    return new Request("https://example.test/api/v1/thing", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body,
    });
}

/** A request whose body arrives in chunks and declares no content-length. */
function chunkedRequest(chunkCount: number, chunkSize: number): Request {
    const chunk = new TextEncoder().encode("x".repeat(chunkSize));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            if (sent++ >= chunkCount) return controller.close();
            controller.enqueue(chunk);
        },
    });
    return new Request("https://example.test/api/v1/thing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        // @ts-expect-error duplex is required for a stream body and is not in the DOM types
        duplex: "half",
    });
}

describe("readJsonBody", () => {
    it("parses a body inside the cap", async () => {
        const body = await readJsonBody(jsonRequest(JSON.stringify({ hello: "world" })));
        expect(body).toEqual({ hello: "world" });
    });

    it("answers 400 for a body that is not JSON", async () => {
        const result = await readJsonBody(jsonRequest("{ not json"));
        expect(result).toBeInstanceOf(NextResponse);
        expect((result as NextResponse).status).toBe(400);
        expect((await (result as NextResponse).json()).code).toBe("invalid_json");
    });

    it("answers 400 for an empty body", async () => {
        const result = await readJsonBody(jsonRequest(""));
        expect((result as NextResponse).status).toBe(400);
    });

    it("answers 413 for a body past the cap", async () => {
        const oversized = JSON.stringify({ note: "A".repeat(MAX_JSON_BODY_BYTES + 1024) });
        const result = await readJsonBody(jsonRequest(oversized));
        expect(result).toBeInstanceOf(NextResponse);
        expect((result as NextResponse).status).toBe(413);
        expect((await (result as NextResponse).json()).code).toBe("body_too_large");
    });

    it("honours a route's own larger cap", async () => {
        const body = JSON.stringify({ note: "A".repeat(MAX_JSON_BODY_BYTES + 1024) });
        const parsed = (await readJsonBody(jsonRequest(body), {
            maxBytes: MAX_JSON_BODY_BYTES * 4,
        })) as { note: string };
        expect(parsed.note.length).toBe(MAX_JSON_BODY_BYTES + 1024);
    });

    it("honours a route's own smaller cap", async () => {
        const result = await readJsonBody(jsonRequest(JSON.stringify({ a: "aaaaaaaaaa" })), { maxBytes: 8 });
        expect((result as NextResponse).status).toBe(413);
    });

    it("stops a chunked body that never declares a length", async () => {
        // 12 chunks of 128 KiB is 1.5 MiB, sent with no content-length at all,
        // which is how a client bypasses a header-only check.
        const result = await readJsonBody(chunkedRequest(12, 128 * 1024));
        expect(result).toBeInstanceOf(NextResponse);
        expect((result as NextResponse).status).toBe(413);
    });

    it("reads a chunked body that stays inside the cap", async () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                const parts = ['{"a":', '1}'];
                for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
                controller.close();
            },
        });
        const request = new Request("https://example.test/api/v1/thing", {
            method: "POST",
            body: stream,
            // @ts-expect-error duplex is required for a stream body and is not in the DOM types
            duplex: "half",
        });
        expect(await readJsonBody(request)).toEqual({ a: 1 });
    });

    it("refuses a body whose declared length is past the cap without reading it", async () => {
        const request = jsonRequest("{}", { "content-length": String(MAX_JSON_BODY_BYTES + 1) });
        const result = await readJsonBody(request);
        expect((result as NextResponse).status).toBe(413);
    });

    it("decodes multi-byte characters by bytes, not by characters", async () => {
        // Three bytes each, so 400 of them is 1200 bytes and the cap is on bytes.
        const body = JSON.stringify({ note: "ç".repeat(400) });
        expect((await readJsonBody(jsonRequest(body), { maxBytes: 200 }))?.constructor).toBe(NextResponse);
        expect(await readJsonBody(jsonRequest(body), { maxBytes: 4000 })).toEqual({ note: "ç".repeat(400) });
    });

    describe("an optional body", () => {
        it("falls back instead of answering 400", async () => {
            expect(await readJsonBody(jsonRequest(""), { fallback: {} })).toEqual({});
            expect(await readJsonBody(jsonRequest("nope"), { fallback: null })).toBeNull();
        });

        it("is still bounded", async () => {
            const oversized = JSON.stringify({ note: "A".repeat(MAX_JSON_BODY_BYTES + 1024) });
            const result = await readJsonBody(jsonRequest(oversized), { fallback: {} });
            expect(result).toBeInstanceOf(NextResponse);
            expect((result as NextResponse).status).toBe(413);
        });

        it("still parses a body that is there", async () => {
            expect(await readJsonBody(jsonRequest('{"a":1}'), { fallback: {} })).toEqual({ a: 1 });
        });
    });
});

describe("every route reads its body through the one door", () => {
    const routes: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === "node_modules") continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name === "route.ts") routes.push(full);
        }
    };
    for (const base of ["src/app/api", "module-sources"]) walk(path.join(ROOT, base));

    it("finds the routes to check", () => {
        expect(routes.length).toBeGreaterThan(150);
    });

    it("never calls request.json() directly, which reads without a cap", () => {
        const offenders = routes
            .filter((file) => /\b(?:request|req)\s*\.\s*json\s*\(\s*\)/.test(fs.readFileSync(file, "utf8")))
            .map((file) => path.relative(ROOT, file));
        expect(offenders).toEqual([]);
    });

    it("guards every readJsonBody call with the sentinel check", () => {
        const offenders: string[] = [];
        for (const file of routes) {
            const source = fs.readFileSync(file, "utf8");
            for (const m of source.matchAll(/const (\w+) = await readJsonBody\(/g)) {
                const after = source.slice(m.index, m.index + 400);
                if (!new RegExp(`if \\(${m[1]} instanceof NextResponse\\)`).test(after)) {
                    offenders.push(`${path.relative(ROOT, file)}: ${m[1]}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it("keeps an absolute ceiling in the proxy, ahead of every handler", () => {
        const proxy = fs.readFileSync(path.join(ROOT, "src/proxy.ts"), "utf8");
        expect(proxy).toContain("MAX_REQUEST_BYTES");
        expect(proxy).toMatch(/content-length/);
        expect(proxy).toContain("body_too_large");
    });
});
