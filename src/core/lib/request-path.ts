/**
 * What a request URL is allowed to contain.
 *
 * A control character has no meaning in a URL path, and letting one through
 * cost two things. next-intl's middleware strips a trailing segment that is
 * nothing but one, so `/en/%00` answered 200 with the homepage and
 * `/en/store/%00` with the store page: every page on the site had an
 * unbounded supply of URLs reporting 200 for content that is not there, which
 * is a soft 404 to a crawler and a false green to a link checker or an uptime
 * monitor.
 *
 * The second cost is the shape rather than the size. A layer that strips a
 * character while the gates match on the string that still carries it is how
 * a gate gets walked past, and `%0a` in a path forges a line in any log that
 * formats rather than encodes.
 *
 * The query string is held to the same rule, and was not. A `%00` in any
 * query value that reached a Prisma string filter answered 500: Postgres text
 * cannot hold a null byte, so the driver threw and the handler had nothing to
 * say about it. `/api/v1/punishments?search=%00` and
 * `/api/v1/store/products?search=%00` were two of them, and every endpoint
 * that passes a search term or a filter through to a query was another. A
 * null byte in a URL is not a search anyone typed; it is refused at the edge
 * rather than sanitised at each of the places it can reach.
 */

/** Highest C0 control, and DEL. */
const LAST_C0 = 0x1f;
const DEL = 0x7f;

/**
 * The same set percent-escaped. Both spellings are refused because which one
 * reaches a given layer depends on whoever normalised the URL before it.
 */
const CONTROL_ESCAPE = /%(?:[01][0-9a-fA-F]|7[fF])/;

/**
 * Compared by code point rather than matched by a character class, so nothing
 * in this file is a character a terminal or a diff would swallow.
 */
export function hasControlCharacter(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code <= LAST_C0 || code === DEL) return true;
    }
    return CONTROL_ESCAPE.test(value);
}
