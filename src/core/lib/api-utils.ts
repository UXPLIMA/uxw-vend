import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP, rateLimits } from "./rate-limit";

/**
 * Canonical API envelope shapes.
 *
 * Every new or migrated endpoint should return one of these via `apiSuccess`,
 * `apiError`, or `apiPaginated` so clients can type-check responses uniformly.
 *
 * Success: `{ ok: true, data: <T> }`                        (+ pagination when relevant)
 * Error:   `{ ok: false, error: "human message", code?: "machine_code", details?: unknown }`
 *
 * Legacy endpoints still return ad-hoc `{ error }` / `{ data }` / `{ message }`
 * shapes — these are being migrated incrementally. New code MUST use these
 * helpers; prefer `apiError(..., { code: "..." })` so clients can branch on
 * the stable `code` instead of string matching on the message.
 */
export interface ApiSuccess<T> {
    ok: true;
    data: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasMore: boolean;
    };
}

export interface ApiFailure {
    ok: false;
    error: string;
    code?: string;
    details?: unknown;
}

export type ApiResponseBody<T> = ApiSuccess<T> | ApiFailure;

export interface ApiErrorOptions {
    code?: string;
    details?: unknown;
    headers?: HeadersInit;
}

export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit): NextResponse {
    const body: ApiSuccess<T> = { ok: true, data };
    return NextResponse.json(body, { status, headers });
}

export function apiError(message: string, status = 400, options: ApiErrorOptions = {}): NextResponse {
    const body: ApiFailure = { ok: false, error: message };
    if (options.code) body.code = options.code;
    if (options.details !== undefined) body.details = options.details;
    return NextResponse.json(body, { status, headers: options.headers });
}

/**
 * Return the error message only outside production. In production we mask
 * internal details so a crashing Prisma / fs / fetch call cannot leak DB
 * hostnames, filesystem paths, stack frames, or other reconnaissance data
 * to the caller. Use this whenever `err.message` would otherwise appear
 * verbatim in a response body.
 *
 *   catch (err) {
 *     return apiError("Upload failed", 500, { details: devOnlyDetail(err) });
 *   }
 *
 * `details` is dropped by apiError when undefined so the wire envelope
 * stays clean.
 */
export function devOnlyDetail(err: unknown): string | undefined {
    if (process.env.NODE_ENV === "production") return undefined;
    if (err instanceof Error) return err.message;
    if (err === undefined || err === null) return undefined;
    return String(err);
}

export function apiPaginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    status = 200,
): NextResponse {
    const body: ApiSuccess<T[]> = {
        ok: true,
        data: items,
        pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
            hasMore: page * limit < total,
        },
    };
    return NextResponse.json(body, { status });
}

/**
 * Wrap a handler with IP-based rate limiting. The rate limit envelope uses the
 * standard `apiError` shape with `code: "rate_limited"` so clients can branch
 * on it cleanly.
 */
export function withRateLimit(
    handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
    config = rateLimits.api,
) {
    return async (request: NextRequest, ...args: unknown[]) => {
        const ip = getClientIP(request.headers);
        const { success, remaining, resetAt } = await rateLimit(ip, config);

        if (!success) {
            return apiError("Too many requests. Please try again later.", 429, {
                code: "rate_limited",
                headers: {
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
                    "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
                },
            });
        }

        const response = await handler(request, ...args);
        response.headers.set("X-RateLimit-Remaining", String(remaining));
        return response;
    };
}
