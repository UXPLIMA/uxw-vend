/**
 * Reading numbers and enums out of a query string without turning a client
 * mistake into a 500.
 *
 * Prisma validates its own arguments before it builds any SQL, and it does it
 * by throwing. `skip: NaN`, `take: NaN` and `skip: -24` are all
 * PrismaClientValidationError; so is a `where` on an enum column carrying a
 * value the enum does not have. In an App Router handler an uncaught throw is
 * a 500 with no body, so `?page=abc` and `?status=nope` were server errors
 * attributed to the server, complete with a stack in the log and a bump in
 * whatever watches the error rate - for a request that was simply wrong.
 *
 * Most paginated routes here had already worked the numeric half out by hand,
 * as `Math.min(100, Math.max(1, parseInt(raw || "20") || 20))`. That nested
 * expression is doing three separate jobs, and the one that is easy to leave
 * off is the innermost `|| 20`: without it a non-numeric page is NaN, and
 * `Math.min` and `Math.max` both pass NaN straight through. This is that
 * expression, named, with the NaN case unmissable.
 *
 * The enum half had not been worked out anywhere. `intParam` clamps, because a
 * page number out of range has an obvious nearest sensible answer; `enumParam`
 * refuses, because an unrecognised filter value does not - silently dropping
 * the filter would answer a question the caller did not ask. It returns the
 * 400 the same way `readJsonBody` does:
 *
 *     const status = enumParam(searchParams, "status", TICKET_STATUSES);
 *     if (status instanceof NextResponse) return status;
 *     if (status) where.status = status;
 *
 * Unlike `readJsonBody` the return type here is a real union, so a caller who
 * forgets the guard fails to compile rather than failing in a test.
 */
import { NextResponse } from "next/server";

/** The one wording for a query parameter that is not one of its allowed values. */
export const INVALID_QUERY_PARAM = "invalid_query_param";

function clamp(value: number, min: number, max?: number): number {
    const lower = Math.max(min, value);
    return max === undefined ? lower : Math.min(max, lower);
}

/**
 * An integer query parameter, clamped into range, never NaN.
 *
 * `fallback` is used when the parameter is absent, empty, or not a number.
 * It is clamped too, so a caller cannot set a default outside its own bounds.
 */
export function intParam(
    params: URLSearchParams,
    name: string,
    { fallback, min = 1, max }: { fallback: number; min?: number; max?: number },
): number {
    const parsed = Number.parseInt(params.get(name) ?? "", 10);
    return clamp(Number.isFinite(parsed) ? parsed : fallback, min, max);
}

/**
 * An enum query parameter: the value, `null` when the caller did not ask for
 * one, or the 400 to return when they asked for something that does not exist.
 */
export function enumParam<T extends string>(
    params: URLSearchParams,
    name: string,
    allowed: readonly T[],
): T | null | NextResponse {
    const raw = params.get(name);
    if (raw === null || raw === "") return null;
    if ((allowed as readonly string[]).includes(raw)) return raw as T;
    return NextResponse.json(
        { error: `Invalid '${name}'`, code: INVALID_QUERY_PARAM, allowed },
        { status: 400 },
    );
}
