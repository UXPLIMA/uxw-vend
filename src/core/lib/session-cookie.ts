/**
 * Does this request carry a session cookie?
 *
 * Not "is this visitor signed in" - a cookie can be expired, forged or
 * revoked, and only `auth()` knows. This answers the cheaper question without
 * touching the database, so a caller may treat a false as certain and a true
 * as merely possible.
 *
 * It lives here, out of the proxy, because the proxy asked it with
 * `cookieHeader.includes('authjs.session-token')`. That is also true of a
 * cookie whose *value* contains the text, and a visitor chooses their own
 * values. The cost of that was small - the one caller it could fool skips a
 * redirect the admin page performs for itself - but a helper whose name
 * promises one thing and whose body answers another is a trap for whoever
 * calls it next.
 */

/**
 * The names Auth.js may use. `__Secure-` and `__Host-` are added by the
 * browser-facing prefixes it sets over https, and `next-auth.` is the name it
 * used before the rename, still present in a session issued by an older build.
 */
const SESSION_COOKIE_NAMES = [
    "authjs.session-token",
    "next-auth.session-token",
];

const PREFIXES = ["", "__Secure-", "__Host-"];

const SESSION_NAMES = new Set(
    PREFIXES.flatMap((prefix) => SESSION_COOKIE_NAMES.map((name) => prefix + name)),
);

export function carriesSessionCookie(cookieHeader: string | null | undefined): boolean {
    if (!cookieHeader) return false;

    for (const pair of cookieHeader.split(";")) {
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        // An empty value is how a sign-out looks: the server clears the cookie
        // by sending the same name with nothing in it.
        if (!pair.slice(eq + 1).trim()) continue;
        if (SESSION_NAMES.has(pair.slice(0, eq).trim())) return true;
    }
    return false;
}
