/**
 * Splits the message catalogue by where it is actually rendered.
 *
 * `getMessages()` returns every namespace core and the enabled modules ship,
 * and the locale layout hands that object to `NextIntlClientProvider`, which
 * serialises all of it into the HTML of every page. The `admin` namespace is
 * around four fifths of the core catalogue and no public page renders a single
 * key from it, so a visitor was downloading the whole admin panel's copy to
 * read a product page.
 *
 * The admin tree re-provides the full catalogue: `IntlProvider` replaces
 * messages rather than merging them, so the nested provider has to carry
 * everything, not just the part the outer one dropped.
 */

/** Namespaces rendered only inside the admin panel. */
export const ADMIN_ONLY_NAMESPACES = ["admin"] as const;

export function withoutAdminNamespaces(
    messages: Record<string, unknown>,
): Record<string, unknown> {
    const scoped: Record<string, unknown> = {};
    for (const [namespace, value] of Object.entries(messages)) {
        if ((ADMIN_ONLY_NAMESPACES as readonly string[]).includes(namespace)) continue;
        scoped[namespace] = value;
    }
    return scoped;
}
