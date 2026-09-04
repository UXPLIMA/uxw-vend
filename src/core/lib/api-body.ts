/**
 * Reading a JSON request body without turning a client mistake into a 500.
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
 * A route that treats the body as optional - a POST with nothing to send, a
 * PATCH with no fields - should keep using `.json().catch(() => ({}))`
 * instead. That is a different contract, deliberately, and
 * `tests/unit/json-body-contract.test.ts` allows it.
 */
import { NextResponse } from "next/server";

/** The one wording for a body that is not JSON. */
export const INVALID_JSON_BODY = { error: "Invalid JSON body", code: "invalid_json" } as const;

/**
 * Parse a JSON request body, or the 400 to return instead.
 *
 * The return type mirrors `Request.json()`, which the DOM lib types as
 * `Promise<any>`. Narrowing it to `unknown` here would be more honest about
 * what arrives on the wire, but it would also push a cast into all hundred
 * and twenty call sites that this helper exists to simplify - and every one
 * of them already validates what it got, with Zod or by hand. The `any` is
 * the same `any` the call sites have today, moved into one place.
 *
 * The cost of that is that `any` swallows the union: TypeScript cannot make
 * a caller check the sentinel, and a route that forgot the guard would hand
 * a `NextResponse` to its own validator. `tests/unit/json-body-contract.ts`
 * checks it instead - every call is followed by the guard, or the gate
 * fails.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJsonBody(request: Request): Promise<any> {
    try {
        return await request.json();
    } catch {
        return NextResponse.json(INVALID_JSON_BODY, { status: 400 });
    }
}
