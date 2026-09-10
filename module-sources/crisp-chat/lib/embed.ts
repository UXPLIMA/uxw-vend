/**
 * The one thing an operator pastes, and why it is refused unless it is right.
 *
 * The other chat provider this platform ships puts its ids into the path of a
 * script URL, so an unchecked one is a script-src injection outright. This one
 * works the other way round: the script address is fixed and the site is named
 * by a value the page hands the widget. That looks safer, and it is only safer
 * while the value stays a value.
 *
 * Two reasons to refuse anything that is not the shape the provider issues.
 *
 * The one that bites today is quiet. An operator pastes what they were given -
 * an email, a dashboard URL, the whole embed snippet - and a value that is not
 * an id makes the widget do nothing at all. No error, no bubble, and no way to
 * tell it from a provider outage; they find out when a customer says nobody
 * answered.
 *
 * The one that would bite later is not quiet. The obvious way to hand a value
 * to a widget is to write it into an inline script, and the moment somebody
 * does that an unchecked value is arbitrary JavaScript on every page of the
 * site. Refusing here closes that door before it is opened, which is cheaper
 * than remembering not to open it. The widget beside this file assigns the
 * value to a property instead, so neither door is open today.
 */

/**
 * The setting the id is stored under.
 *
 * Here rather than beside the database read, because the admin screen needs
 * the name and runs in a browser: importing it from the server file dragged
 * Prisma, the logger and `next/headers` into the bundle, which is what
 * `client-bundle-safety` exists to catch a second after it happens rather
 * than three minutes into a build.
 */
export const WEBSITE_KEY = "crisp_website_id";

/** Where the provider serves its widget. Never taken from a setting. */
export const CRISP_SCRIPT = "https://client.crisp.chat/l.js";

/** What the provider issues: a UUID and nothing else. */
const WEBSITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function safeWebsiteId(id: string): string | null {
    const trimmed = id.trim();
    return WEBSITE_ID.test(trimmed) ? trimmed : null;
}
