import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight same-origin CSRF guard for custom API mutation routes.
 *
 * NextAuth already protects its own endpoints (/api/auth/*). This helper is
 * for the dozens of custom state-changing endpoints we own — profile delete,
 * admin CRUD, API keys, module install/enable, etc.
 *
 * Strategy: verify the request's Origin (or Referer as fallback) matches one
 * of the configured allowed origins. This blocks the common CSRF vector of a
 * cross-site form/fetch submitting with the victim's cookies, because browsers
 * will send the attacker's origin in those headers — not ours.
 *
 * Allowed origins are resolved from:
 *   - AUTH_URL / NEXTAUTH_URL / NEXT_PUBLIC_APP_URL (prod canonical URL)
 *   - CSRF_ALLOWED_ORIGINS (comma-separated extras, e.g. staging URLs)
 *   - request.nextUrl.origin (the origin serving the request itself)
 *
 * Safe-method requests (GET/HEAD/OPTIONS) are allowed through unchanged.
 * Server-to-server callers (no browser) can attach an Origin header pointing
 * at the site to pass, or set CSRF_INTERNAL_SECRET and send it in
 * `x-internal-request` — same pattern the proxy used for module status.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseOrigin(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

function resolveAllowedOrigins(request: NextRequest): Set<string> {
    const origins = new Set<string>();

    const fromEnv = [
        process.env.AUTH_URL,
        process.env.NEXTAUTH_URL,
        process.env.NEXT_PUBLIC_APP_URL,
    ];
    for (const raw of fromEnv) {
        const o = parseOrigin(raw);
        if (o) origins.add(o);
    }

    const extras = process.env.CSRF_ALLOWED_ORIGINS;
    if (extras) {
        for (const part of extras.split(",")) {
            const o = parseOrigin(part.trim());
            if (o) origins.add(o);
        }
    }

    // The origin serving this request is always allowed — behind a reverse
    // proxy this reflects the public hostname the client actually hit.
    origins.add(request.nextUrl.origin);

    return origins;
}

export interface CsrfFailure {
    ok: false;
    reason: "origin_missing" | "origin_mismatch";
    received: string | null;
}

export type CsrfResult = { ok: true } | CsrfFailure;

/**
 * Validate that a state-changing request originates from an allowed origin.
 * Returns `{ ok: true }` for safe methods and same-origin requests, otherwise
 * a structured failure the caller can map to a 403.
 */
export function checkCsrf(request: NextRequest): CsrfResult {
    if (SAFE_METHODS.has(request.method)) return { ok: true };

    const internalSecret = process.env.CSRF_INTERNAL_SECRET;
    if (internalSecret && request.headers.get("x-internal-request") === internalSecret) {
        return { ok: true };
    }

    const allowed = resolveAllowedOrigins(request);
    const originHeader = request.headers.get("origin");
    const refererHeader = request.headers.get("referer");

    const candidate = parseOrigin(originHeader) ?? parseOrigin(refererHeader);
    if (!candidate) {
        return { ok: false, reason: "origin_missing", received: originHeader ?? refererHeader };
    }

    if (!allowed.has(candidate)) {
        return { ok: false, reason: "origin_mismatch", received: candidate };
    }

    return { ok: true };
}

/**
 * Convenience wrapper that returns a NextResponse 403 ready to return from
 * a route handler, or `null` when the request passes the CSRF check.
 *
 * Usage:
 *   const bad = requireCsrfOrRespond(request);
 *   if (bad) return bad;
 */
export function requireCsrfOrRespond(request: NextRequest) {
    const result = checkCsrf(request);
    if (result.ok) return null;

    const message = result.reason === "origin_missing"
        ? "Origin header is required"
        : "Origin not allowed";
    return NextResponse.json(
        { ok: false, error: message, code: "csrf_rejected" },
        { status: 403 },
    );
}
