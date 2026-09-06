/**
 * The site's currency, on the server.
 *
 * `default_currency` is the setting the payment gateways charge in, and it is
 * the only honest answer to "what is this number worth". The client half of
 * this lives in `src/core/components/currency/site-currency.tsx`; a server
 * component cannot use a hook, so it reads the row itself.
 *
 * A price rendered on the server is always in the base currency: the visitor's
 * display choice lives in their browser, and a server render that guessed at
 * it would ship one currency in the HTML and another after hydration.
 */

import { prisma } from "./db";
import { cached } from "./cache";
import { dateLocaleTag, formatCurrency } from "./utils";

const CACHE_KEY = "site-currency";
const CACHE_MS = 60_000;
const DEFAULT_BASE = "USD";

/**
 * `Intl.NumberFormat` throws a RangeError on anything that is not three
 * letters, and the setting behind this is a free-text field with `usd` for a
 * placeholder. "us" or "dollar" typed there would not render a wrong price,
 * it would throw inside every server render that shows one: the store, the
 * cart, the product page and the order mail at once. The database can also
 * still hold such a value from before this check existed, so the reading side
 * is where it belongs.
 */
const ISO_4217 = /^[A-Z]{3}$/;

/** The ISO code the gateways charge in, uppercased. */
export async function siteCurrency(): Promise<string> {
    try {
        return await cached<string>(CACHE_KEY, CACHE_MS, async () => {
            const row = await prisma.setting.findUnique({ where: { key: "default_currency" } });
            const value = typeof row?.value === "string" ? row.value.trim().toUpperCase() : "";
            return ISO_4217.test(value) ? value : DEFAULT_BASE;
        });
    } catch {
        // No database yet (build phase, fresh install). A price is not worth
        // failing a render over.
        return DEFAULT_BASE;
    }
}

/** Write an amount in the site's currency, in the reader's language. */
export async function formatSiteCurrency(amount: number | string | null | undefined, locale: string): Promise<string> {
    return formatCurrency(Number(amount) || 0, await siteCurrency(), dateLocaleTag(locale));
}
