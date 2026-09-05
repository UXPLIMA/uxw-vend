import { NextRequest, NextResponse } from "next/server";
import { ModuleApiRegistry } from "@/core/generated/module-api-registry";
import { matchApiRoute, type ApiRouteMatch } from "@/core/lib/api-matcher";
import { logRequest } from "@/core/lib/logger";
import { recordMetric } from "@/core/lib/metrics";
import { auth } from "@/core/lib/auth";
import { getClientIP, rateLimitForRoleAsync } from "@/core/lib/rate-limit";
import { bucketFor, bucketKeyFor } from "@/core/lib/module-api-limits";
import { prismaErrorResponse } from "@/core/lib/prisma-errors";
import { allowHeader } from "@/core/lib/http-methods";

/**
 * Every module endpoint is rate limited, and none of them was.
 *
 * Which bucket an endpoint gets, and why a module may only tighten it, is in
 * module-api-limits.ts. The dispatcher's job is to apply it before it loads a
 * handler, so an endpoint cannot forget and cannot opt out.
 *
 * The bucket is per endpoint and per caller, so one busy endpoint does not
 * spend another's budget, and a signed-in user is counted by their id rather
 * than by an address they may be sharing with a whole campus. Per endpoint
 * means per handler file, not per URL: a manifest may declare one handler at
 * several paths, and keying on the path gave each spelling its own budget.
 *
 * The other thing this file owes a caller is a straight answer about which
 * verbs an endpoint takes. It has to export all five to be reachable by any
 * of them, and Next builds `Allow` from a route file's exports, so every
 * module endpoint used to advertise all seven methods: `OPTIONS
 * /api/v1/leaderboard`, which only reads, answered `Allow: DELETE, GET, HEAD,
 * OPTIONS, PATCH, POST, PUT`. Its 405 carried no `Allow` at all, which
 * RFC 9110 requires of every 405. Both now come from the verbs the handler
 * exports, collected into the route table at build time.
 */

/** Whether this request even carries a session, so an anonymous one costs no decode. */
function hasSessionCookie(req: NextRequest): boolean {
    return req.cookies.getAll().some((c) => c.name.includes("session-token"));
}

async function callerFor(req: NextRequest, match: ApiRouteMatch): Promise<{ id: string; role: string | null }> {
    const ip = getClientIP(req.headers);
    // A provider posts with no cookie and no session; skip the decode.
    if (match.providerCallback || !hasSessionCookie(req)) return { id: `ip:${ip}`, role: null };
    try {
        const session = await auth();
        const userId = session?.user?.id;
        if (userId) return { id: `user:${userId}`, role: session.user.role ?? null };
    } catch {
        // A cookie that will not decode is an anonymous caller, not an error.
    }
    return { id: `ip:${ip}`, role: null };
}

/**
 * The verbs a matched endpoint answers. A manifest `method` narrows what the
 * handler exports; it cannot widen it, so the intersection is the truth.
 */
function allowedMethods(match: ApiRouteMatch, exports?: string[]): string[] {
    const source = exports ?? match.methods ?? [];
    const exported = source.map((m) => m.toUpperCase()).filter((m) => VERBS.includes(m));
    if (match.method && match.method !== "ALL") {
        const declared = match.method.toUpperCase();
        return exported.length > 0 ? exported.filter((m) => m === declared) : [declared];
    }
    return exported;
}

const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * A 405 that says what would have worked. Without a known verb list there is
 * nothing honest to put in `Allow`, and a wrong `Allow` is worse than none.
 */
function methodNotAllowed(method: string, match: ApiRouteMatch, exports?: string[]): NextResponse {
    const allowed = allowedMethods(match, exports);
    return NextResponse.json(
        { error: `Method ${method} not allowed` },
        {
            status: 405,
            ...(allowed.length > 0 ? { headers: { Allow: allowHeader(allowed) } } : {}),
        },
    );
}

async function handleRequest(req: NextRequest, paramsPromise: Promise<{ path: string[] }>, method: string) {
    const { path } = await paramsPromise;
    const fullPath = `/api/v1/${path.join("/")}`;
    const requestStart = Date.now();
    const { correlationId, finish } = logRequest(method, fullPath);
    const match = matchApiRoute(path);

    if (!match) {
        finish(404);
        recordMetric(method, fullPath, 404, Date.now() - requestStart);
        return NextResponse.json({ error: "API route not found" }, { status: 404 });
    }

    // Enforce method restriction from module manifest
    if (match.method && match.method !== "ALL" && match.method !== method) {
        finish(405);
        recordMetric(method, fullPath, 405, Date.now() - requestStart);
        return methodNotAllowed(method, match);
    }

    const caller = await callerFor(req, match);
    const allowed = await rateLimitForRoleAsync(
        `module-api:${bucketKeyFor(match)}:${caller.id}`,
        bucketFor(match),
        caller.role,
    );
    if (!allowed) {
        finish(429, { handler: match.key });
        recordMetric(method, fullPath, 429, Date.now() - requestStart);
        return NextResponse.json(
            { error: "Too many requests", code: "rate_limited" },
            { status: 429, headers: { "Retry-After": "60" } },
        );
    }

    const loadHandler = ModuleApiRegistry[match.key];
    if (!loadHandler) {
        finish(500, { error: "handler_missing", handler: match.key });
        recordMetric(method, fullPath, 500, Date.now() - requestStart);
        return NextResponse.json({ error: "API handler missing" }, { status: 500 });
    }

    try {
        const handlerModule = await loadHandler();
        const handler = handlerModule[method] as
            | ((req: NextRequest, ctx: { params: Record<string, string | string[]> }) => Promise<NextResponse>)
            | undefined;

        if (typeof handler !== "function") {
            finish(405);
            recordMetric(method, fullPath, 405, Date.now() - requestStart);
            // The module is loaded here, so its exports are the last word -
            // truer than the table if the two ever disagree.
            return methodNotAllowed(method, match, Object.keys(handlerModule));
        }

        const response: NextResponse = await handler(req, { params: { ...match.params } });
        const status = response.status || 200;
        finish(status, { handler: match.key });
        recordMetric(method, fullPath, status, Date.now() - requestStart);
        response.headers.set("x-correlation-id", correlationId);
        return response;
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        // Prisma names the caller's mistakes. A handler that deletes by id
        // without catching would otherwise report a row that is already gone
        // as a server fault; the same for a unique column that is taken.
        const known = prismaErrorResponse(error);
        if (known) {
            finish(known.status, { error: known.code, handler: match.key });
            recordMetric(method, fullPath, known.status, Date.now() - requestStart);
            return NextResponse.json({ error: known.error }, { status: known.status });
        }
        finish(500, { error: errMsg, handler: match.key });
        recordMetric(method, fullPath, 500, Date.now() - requestStart);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "GET");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "POST");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "PUT");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "DELETE");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "PATCH");
}

/**
 * Next synthesises OPTIONS from a route file's exports, which for this file
 * is every verb there is. Answering it here instead means an endpoint reports
 * the verbs its own handler exports.
 */
export async function OPTIONS(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const match = matchApiRoute(path);
    if (!match) {
        return NextResponse.json({ error: "API route not found" }, { status: 404 });
    }
    const allowed = allowedMethods(match);
    if (allowed.length === 0) {
        // Nothing known about this endpoint's verbs: say so by omission
        // rather than by listing all of them, which is what used to happen.
        return new NextResponse(null, { status: 204 });
    }
    return new NextResponse(null, { status: 204, headers: { Allow: allowHeader(allowed) } });
}
