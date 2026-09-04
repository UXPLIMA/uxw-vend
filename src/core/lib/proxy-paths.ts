/**
 * Path helpers for the proxy (src/proxy.ts).
 *
 * Kept separate from the proxy itself so they can be tested without pulling
 * Auth.js, Prisma and next-intl into the test process. The proxy's own
 * `config.matcher` has to stay a literal array in that file - Next reads it
 * statically at build time - so it is guarded by a source-level test instead.
 */

/**
 * True for requests that carry no session and no side effects: Next's own
 * build output and the files served out of /public.
 *
 * A dot is the signal for /public, and it is a bad signal anywhere under
 * /api: ids are allowed to contain one, and the store resolves a product with
 * `Number(id)`, so `products/1.` reads the same row as `products/1`. Every
 * gate in the proxy - CSRF, the IP blocklist, maintenance mode, the setup
 * wizard, the module-enabled check, the demo write gate - stood aside for a
 * request that added a trailing dot until this returned false for /api.
 */
export function isStaticAsset(pathname: string): boolean {
    if (pathname === "/api" || pathname.startsWith("/api/")) return false;
    return (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/_vercel") ||
        pathname.includes(".")
    );
}
