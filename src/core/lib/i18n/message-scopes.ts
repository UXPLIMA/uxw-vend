/**
 * Splits the message catalogue by where it is actually rendered.
 *
 * `getMessages()` returns every namespace core and the enabled modules ship,
 * and the locale layout hands that object to `NextIntlClientProvider`, which
 * serialises all of it into the HTML of every page. Most of that copy belongs
 * to screens a visitor never opens, so a visitor was downloading the whole
 * admin panel's wording to read a product page.
 *
 * Two rules trim it:
 *
 * - Whole namespaces that only an operator screen renders (`admin`, `setup`).
 * - Inside every surviving namespace, the keys a module prefixes `adm_`. A
 *   module owns a single namespace and puts its admin screen's copy in it, so
 *   the prefix is the only line between "shown in the store" and "shown in the
 *   store's admin page". `scripts/validate-module.ts` holds modules to that
 *   convention and `tests/unit/message-scopes.test.tsx` holds the repo to it.
 *
 * Both trees that need the full catalogue re-provide it: `IntlProvider`
 * replaces messages rather than merging them, so a nested provider has to
 * carry everything, not just the part the outer one dropped.
 */

/** Namespaces rendered only by an operator screen, never by a public page. */
export const NON_PUBLIC_NAMESPACES = ["admin", "setup"] as const;

/** Prefix a module puts on the keys only its admin screen renders. */
export const MODULE_ADMIN_KEY_PREFIX = "adm_";

export function publicMessages(
    messages: Record<string, unknown>,
): Record<string, unknown> {
    const scoped: Record<string, unknown> = {};
    for (const [namespace, value] of Object.entries(messages)) {
        if ((NON_PUBLIC_NAMESPACES as readonly string[]).includes(namespace)) continue;
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            scoped[namespace] = value;
            continue;
        }
        const kept: Record<string, unknown> = {};
        for (const [key, message] of Object.entries(value as Record<string, unknown>)) {
            if (key.startsWith(MODULE_ADMIN_KEY_PREFIX)) continue;
            kept[key] = message;
        }
        scoped[namespace] = kept;
    }
    return scoped;
}
