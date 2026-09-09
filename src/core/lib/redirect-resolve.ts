/**
 * Moving a page and leaving a sign on the old door.
 *
 * An operator renames a page, and every link to the old address on every forum
 * and search engine still points at it. A redirect is the sign, and it has
 * three ways of going wrong that the admin screen cannot show, because the
 * screen shows exactly what was typed.
 *
 * A circle. `/a` to `/b` and `/b` back to `/a` is two rules that each look
 * right alone; a browser follows them twenty times and gives up. It is
 * answered here, where both rules are visible, rather than by the visitor.
 *
 * An open redirect. A target that is not obviously a page of ours turns the
 * site into a redirector for whoever asks: a link that starts on a domain
 * somebody trusts and ends somewhere else. An internal target is held to the
 * same rules as every other destination here, and leaving the site has to be
 * said out loud with a whole https address.
 *
 * The locale. Every page is served under a language prefix, and an operator
 * who moved `/pricing` meant both of them. A rule that worked only for the
 * language they happened to be reading is one they write twice and fix once.
 */

export type RedirectRule = RoutingRedirectRule;

/** Longer than any chain somebody meant to write, shorter than a browser's patience. */
const MAX_HOPS = 10;

/** The path as a rule is matched against it: no locale, no slash, one case. */
function normalise(path: string): string {
    const withoutQuery = path.split("?")[0].split("#")[0];
    const trimmed = withoutQuery.replace(/\/+$/, "");
    const stripped = trimmed.replace(/^\/[a-z]{2}(?=\/|$)/i, "");
    const lowered = (stripped || "/").toLowerCase();
    return lowered.startsWith("/") ? lowered : `/${lowered}`;
}

/**
 * Whether a target is a path on this site.
 *
 * The same reasoning as every other destination here: it must start with a
 * slash, and the character after it may not be another slash or a backslash.
 * `//evil.example` is a protocol-relative URL that reads as a path to an
 * operator and as another site to a browser, and a backslash is the second
 * spelling of the same trick because a browser folds it into a slash.
 */
function internalTarget(to: string): string | null {
    const folded = to.replace(/\\/g, "/");
    if (!folded.startsWith("/")) return null;
    if (folded.startsWith("//")) return null;
    // A control character in a location header is a header-splitting attempt,
    // and no honest path carries one.
    if (/[\u0000-\u001f\u007f]/.test(folded)) return null;
    return folded;
}

/** Whether a target is somewhere else, said out loud. */
function externalTarget(to: string): string | null {
    // https only. `http` is a downgrade, and anything else is a scheme nobody
    // puts in a redirect for an honest reason.
    return /^https:\/\/[^\s/]+/i.test(to) ? to : null;
}

/** Where this request should be sent, or null to leave it alone. */
export function resolveRedirect(
    path: string,
    locale: string,
    rules: RedirectRule[],
): { to: string; permanent: boolean } | null {
    const query = path.includes("?") ? path.slice(path.indexOf("?")) : "";

    const byFrom = new Map<string, RedirectRule>();
    for (const rule of rules) byFrom.set(normalise(rule.from), rule);

    let here = normalise(path);
    const seen = new Set<string>([here]);
    let landed: { to: string; permanent: boolean } | null = null;

    for (let hop = 0; hop < MAX_HOPS; hop += 1) {
        const rule = byFrom.get(here);
        if (!rule) break;

        const away = externalTarget(rule.to);
        if (away) return { to: `${away}${query}`, permanent: rule.permanent };

        const inside = internalTarget(rule.to);
        // A target that is neither a path of ours nor a whole https address is
        // not a destination, and following it is the open redirect.
        if (!inside) return null;

        const next = normalise(inside);
        // A circle. Answered here rather than by a browser giving up.
        if (seen.has(next)) return null;
        seen.add(next);

        landed = { to: inside, permanent: rule.permanent };
        here = next;
    }

    // A chain longer than anybody meant to write is a mistake wearing a
    // chain's clothes, and its last hop is as likely wrong as its first.
    if (byFrom.has(here)) return null;
    if (!landed) return null;

    return { to: `/${locale}${landed.to === "/" ? "" : landed.to}${query}`, permanent: landed.permanent };
}
