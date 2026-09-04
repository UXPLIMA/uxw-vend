/**
 * Reading a JSON request body without turning a client mistake into a 500,
 * and without letting the caller decide how much memory to spend.
 *
 * `request.json()` throws on a body that is not JSON - malformed, truncated,
 * or absent entirely. In an App Router route handler an uncaught throw is a
 * 500 with no body, which is the wrong answer twice over: the fault is the
 * caller's, and the platform ships an OpenAPI document and API keys, so the
 * callers are not only its own forms. It also files the request as a server
 * error, which is what the health alerting watches.
 *
 * Sixteen routes had already worked this out and hand-rolled the same
 * `let body: unknown; try { … } catch { return 400 }` block, in four
 * different wordings. A hundred and eleven others had not. This is that
 * block, once:
 *
 *     const body = await readJsonBody(request);
 *     if (body instanceof NextResponse) return body;
 *     // `body` is the parsed value from here on
 *
 * The sentinel is the response itself rather than a `{ ok, data }` pair so
 * the parsed value keeps the name and the type it already had at the call
 * site, and the guard is one line.
 *
 * ## The size cap
 *
 * `request.json()` also reads whatever it is given. App Router route handlers
 * have no body limit of their own - the 1 MB that Pages API routes shipped
 * with does not apply here - so every JSON endpoint accepted a body of any
 * size, buffered whole in memory before the route's own validation could
 * refuse a single field of it. An 8 MB registration body was parsed and
 * answered in 140 ms, and nothing about that request was unusual except its
 * size. Concurrency turns that into the whole heap.
 *
 * So the body is read as a stream and abandoned the moment it passes
 * `maxBytes`, rather than measured after the fact: a `content-length` header
 * is a claim, and chunked encoding does not have to send one at all. The
 * default is 1 MiB, comfortably above every bound the schemas in this
 * repository set (the largest is a 100000 character blog article) and far
 * below anything worth buffering by accident. A route that genuinely carries
 * more says so:
 *
 *     const body = await readJsonBody(request, { maxBytes: 8 * 1024 * 1024 });
 *
 * File uploads do not come through here. They are multipart, they have their
 * own ceiling in `storage.ts`, and `proxy.ts` refuses anything above the
 * largest body the application accepts at all before a route ever runs.
 *
 * A route that treats the body as optional - a POST with nothing to send, a
 * PATCH with no fields - passes `fallback` instead of hand-rolling
 * `.json().catch(() => ({}))`. That keeps the optional-body contract while
 * keeping the size cap, which a bare `.catch` silently gave up.
 */
import { NextResponse } from "next/server";

/** The one wording for a body that is not JSON. */
export const INVALID_JSON_BODY = { error: "Invalid JSON body", code: "invalid_json" } as const;

/** The one wording for a body that is too large to read. */
export const BODY_TOO_LARGE = { error: "Request body too large", code: "body_too_large" } as const;

/** How much JSON a route accepts unless it asks for more. */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

export interface ReadJsonBodyOptions {
    /** Ceiling in bytes for the raw body. Defaults to `MAX_JSON_BODY_BYTES`. */
    maxBytes?: number;
    /**
     * What to return when the body is absent or is not JSON. Supply it to
     * make the body optional; omit it to answer 400 instead. An oversized
     * body is still a 413 either way - optional does not mean unbounded.
     */
    fallback?: unknown;
}

/**
 * The body as text, or `null` when it is larger than `maxBytes`.
 *
 * Reads incrementally and cancels rather than buffering first and checking
 * after, so an oversized body costs `maxBytes` of memory and no more.
 */
async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) return null;

    const stream = request.body;
    if (!stream) {
        // No stream to read (an already-consumed or synthesised request).
        const text = await request.text();
        return new TextEncoder().encode(text).length > maxBytes ? null : text;
    }

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            return null;
        }
        chunks.push(value);
    }

    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(joined);
}

/**
 * Parse a JSON request body, or the response to return instead.
 *
 * The return type is `unknown`, not the `Promise<any>` that `Request.json()`
 * is typed as. This used to be `any`, on the reasoning that every call site
 * already validated what it got, with Zod or by hand. That reasoning was
 * wrong: sixty-two write handlers read a body and never ran a schema over it.
 * They passed client-supplied values straight into Prisma, where a string
 * where a number was meant is a 500 rather than a 400, a string with no
 * declared bound is whatever fits under the size cap, and an object in a
 * `where` clause is not a value at all but a filter operator.
 *
 * `unknown` is what actually arrives on the wire, and typing it honestly is
 * what makes the omission impossible: reaching into the body without
 * narrowing it first does not compile. The narrowing is a Zod schema, which
 * most call sites already had.
 *
 * It also fixes the sentinel. `any` swallowed the union, so nothing made a
 * caller check for the 400/413 response and a route that forgot the guard
 * handed a `NextResponse` to its own validator. With `unknown` the guard is
 * the only way to get a usable value out.
 */
export async function readJsonBody(request: Request, options: ReadJsonBodyOptions = {}): Promise<unknown> {
    const text = await readBoundedText(request, options.maxBytes ?? MAX_JSON_BODY_BYTES);
    if (text === null) return NextResponse.json(BODY_TOO_LARGE, { status: 413 });
    try {
        return JSON.parse(text);
    } catch {
        if ("fallback" in options) return options.fallback;
        return NextResponse.json(INVALID_JSON_BODY, { status: 400 });
    }
}
