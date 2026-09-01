/**
 * Next.js-style path pattern matching, shared by the page router
 * (`route-matcher.ts`) and the API router (`api-matcher.ts`).
 *
 * The two used to carry their own near-identical copy of this logic, and
 * they had already drifted: the page matcher handled `[...rest]` catch-alls,
 * the API matcher did not. Its regex builder turned `[...rest]` into the
 * capture group `(?<...rest>…)`, which is not a legal group name — so
 * `new RegExp` threw a SyntaxError, from a loop that runs on every API path
 * that is not an exact match. One module declaring a catch-all under `api`
 * would have taken down the whole module API router, not just its own
 * routes. Nothing in the manifest schema forbids that path.
 *
 * Patterns come from `module.json`, validated against
 * `^\/[A-Za-z0-9/_\-:.\[\]*]*$`. That allowlist still admits regex
 * metacharacters (`.` and `*`), so literal segments are escaped rather than
 * interpolated: `/store/v1.0` must not match `/store/v1X0`.
 */

export interface PathMatch {
    params: Record<string, string>;
}

/** Escape every regex metacharacter in a literal path segment. */
function escapeLiteral(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the pattern contains any dynamic segment. */
export function isDynamicPattern(pattern: string): boolean {
    return pattern.includes("[");
}

/**
 * Match `urlPath` against a Next.js-style `pattern`.
 *
 * Supports `[param]` (one segment) and a trailing `[...param]` catch-all
 * (one or more segments, returned as a single slash-joined value, matching
 * how the page router has always reported them). Returns null when the
 * pattern does not match, and also when the pattern is malformed — a bad
 * pattern from one module must never throw out of a loop that is walking
 * every other module's routes.
 */
export function matchPathPattern(pattern: string, urlPath: string): PathMatch | null {
    const catchAll = pattern.match(/^(.*)\/\[\.\.\.(\w+)\]$/);
    if (catchAll) {
        const [, prefix, paramName] = catchAll;
        if (!urlPath.startsWith(prefix + "/")) return null;
        const rest = urlPath.slice(prefix.length + 1);
        if (!rest) return null;
        return { params: { [paramName]: rest } };
    }

    // A catch-all anywhere but the end is not a valid Next.js route, and
    // its parameter name would be an illegal capture group.
    if (pattern.includes("[...")) return null;

    let source = "^";
    let lastIndex = 0;
    const dynamic = /\[(\w+)\]/g;
    let segment: RegExpExecArray | null;
    while ((segment = dynamic.exec(pattern)) !== null) {
        source += escapeLiteral(pattern.slice(lastIndex, segment.index));
        source += `(?<${segment[1]}>[^/]+)`;
        lastIndex = segment.index + segment[0].length;
    }
    source += escapeLiteral(pattern.slice(lastIndex)) + "$";

    // `[bad-name]` and friends survive the manifest allowlist but are not
    // legal capture group names.
    let regex: RegExp;
    try {
        regex = new RegExp(source);
    } catch {
        return null;
    }

    const match = urlPath.match(regex);
    if (!match) return null;
    return { params: match.groups ? { ...match.groups } : {} };
}
