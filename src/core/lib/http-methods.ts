/**
 * Which verbs a route answers, read from the file that answers them.
 *
 * Module endpoints are all served by one dispatcher, `/api/v1/[...path]`,
 * which exports all five verbs because it has to be reachable by any of them.
 * Next builds the `Allow` header from a route file's exports, so every module
 * endpoint advertised all seven methods whatever its handler supported:
 * `OPTIONS /api/v1/leaderboard`, a GET-only endpoint, answered
 * `Allow: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT`. The 405 the
 * dispatcher returns for an unsupported verb carried no `Allow` at all, which
 * RFC 9110 requires of every 405.
 *
 * The verbs are collected at registry-generation time so the dispatcher can
 * answer both without importing a handler first.
 */

/** The verbs a Next route module may export. */
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * The verbs a route file exports. Both spellings occur in this codebase:
 * `export async function GET` for a handler written here, and
 * `export const { GET, POST } = handlers` for the Auth.js route.
 */
export function exportedHttpMethods(source: string): HttpMethod[] {
    const found = new Set<string>();
    for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
        found.add(m[1]);
    }
    for (const m of source.matchAll(/export\s+const\s*\{([^}]*)\}/g)) {
        for (const name of m[1].split(",")) {
            const verb = name.split(":")[0].trim().toUpperCase();
            if ((HTTP_METHODS as readonly string[]).includes(verb)) found.add(verb);
        }
    }
    return HTTP_METHODS.filter((m) => found.has(m));
}

/**
 * The `Allow` value for a set of verbs, in the order Next writes it:
 * alphabetical, with the two a route answers for free. `HEAD` is only there
 * when `GET` is, because that is the one Next derives.
 */
export function allowHeader(methods: readonly string[]): string {
    const all = new Set<string>(methods.map((m) => m.toUpperCase()));
    if (all.has("GET")) all.add("HEAD");
    all.add("OPTIONS");
    return [...all].sort().join(", ");
}
