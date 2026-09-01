/**
 * Canonical public URL of this installation, resolved at RUNTIME.
 *
 * Why this exists: `NEXT_PUBLIC_*` variables are inlined into the bundle by
 * `next build` (see node_modules/next/dist/docs/01-app/02-guides/self-hosting.md).
 * uxwVend ships a prebuilt image, so anything read from a `NEXT_PUBLIC_*` var
 * is frozen to whatever CI had at build time — for every installation on
 * earth. Reading the canonical URL that way produced sitemaps, robots.txt and
 * OpenGraph tags all pointing at `http://localhost:3001`.
 *
 * `AUTH_URL` / `NEXTAUTH_URL` are plain server variables, so they are read at
 * runtime and already documented in `.env.example` as "the canonical URL the
 * platform is served at". They are the source of truth here; the two public
 * vars remain as fallbacks so existing self-built deployments keep working.
 */

const FALLBACK_APP_URL = "http://localhost:3001";

/** Strip trailing slashes so callers can concatenate paths safely. */
function normalize(raw: string | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().replace(/\/+$/, "");
    if (!trimmed) return null;
    try {
        // Reject anything that is not an absolute http(s) URL — a bad value
        // must not silently become part of a canonical tag.
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return trimmed;
    } catch {
        return null;
    }
}

export function resolveAppUrl(): string {
    return (
        normalize(process.env.AUTH_URL) ??
        normalize(process.env.NEXTAUTH_URL) ??
        normalize(process.env.NEXT_PUBLIC_APP_URL) ??
        normalize(process.env.NEXT_PUBLIC_SITE_URL) ??
        FALLBACK_APP_URL
    );
}

/**
 * Display name of the installation. `SITE_NAME` is the runtime variable
 * `serverConfig` already uses; `NEXT_PUBLIC_APP_NAME` stays as a fallback for
 * deployments that build their own image. Callers that can reach the database
 * should prefer the `site_name` setting — this is the pre-DB fallback.
 */
export function resolveAppName(): string {
    return process.env.SITE_NAME || process.env.NEXT_PUBLIC_APP_NAME || "uxwVend";
}
