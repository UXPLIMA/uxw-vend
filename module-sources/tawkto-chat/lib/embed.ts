/**
 * The URL of somebody else's chat widget, built from ids an operator pasted.
 *
 * Those ids are path segments in a script URL, and a path segment that is not
 * checked is a script-src injection: `../../evil.example/x.js` in the box, and
 * arbitrary JavaScript runs on every page of the site, inside the session, for
 * every visitor. The content security policy narrows where a script may come
 * from; it says nothing about which script comes from there.
 *
 * "Only an admin can set it" is not the answer, for the same reason it was not
 * the answer for a table name: an admin session is one stolen cookie, and the
 * setting is read on every page load afterwards.
 *
 * So an id is refused unless it looks like what the provider issues, and the
 * URL is built only from ids that passed. Not a URL with a hole in it: a
 * script tag pointing at the bare host is a request nobody meant to make.
 */

/** Where the provider serves its widget. Never taken from a setting. */
const HOST = "https://embed.tawk.to";

/** What the provider issues: letters and digits, nothing that has a meaning in a path. */
const ID = /^[A-Za-z0-9]{1,40}$/;

export function safeEmbedId(id: string): string | null {
    const trimmed = id.trim();
    return ID.test(trimmed) ? trimmed : null;
}

/** The script URL, or null when either id is not one. */
export function embedUrl(propertyId: string, widgetId: string): string | null {
    const property = safeEmbedId(propertyId);
    const widget = safeEmbedId(widgetId);
    if (!property || !widget) return null;
    return `${HOST}/${property}/${widget}`;
}
