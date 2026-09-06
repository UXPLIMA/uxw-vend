/**
 * A currency setting that takes the store down.
 *
 * `default_currency` is a free-text field on the payments screen, with `usd`
 * as its placeholder and nothing checking what is typed. `siteCurrency`
 * trims and uppercases it and hands it to `Intl.NumberFormat`, which throws a
 * RangeError on anything that is not three letters. So "us", "dollar", a
 * currency symbol, or an empty string does not produce a wrong price: it
 * produces an exception inside every server render that shows one, which is
 * the store, the cart, the order mail and the product page at once.
 *
 * Reading is the right place to fix it. The database can already hold a bad
 * value from before any validation existed, and a price is not worth failing
 * a render over, which is the reasoning the file already applies to a missing
 * database.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

let settingValue: unknown = "USD";

vi.mock("@/core/lib/db", () => ({
    prisma: {
        setting: {
            findUnique: async () => (settingValue === undefined ? null : { value: settingValue }),
        },
    },
}));

// The cache would hide the setting changing between cases.
vi.mock("@/core/lib/cache", () => ({
    cached: async <T,>(_key: string, _ttl: number, loader: () => Promise<T>) => loader(),
}));

const { siteCurrency, formatSiteCurrency } = await import("@/core/lib/site-currency");

describe("the site currency", () => {
    beforeEach(() => { settingValue = "USD"; });

    it("reads what the operator set", async () => {
        settingValue = "TRY";
        expect(await siteCurrency()).toBe("TRY");
    });

    it("accepts a lowercase setting, because the placeholder is lowercase", async () => {
        settingValue = "  try  ";
        expect(await siteCurrency()).toBe("TRY");
    });

    it("falls back when the setting is missing or empty", async () => {
        settingValue = undefined;
        expect(await siteCurrency()).toBe("USD");
        settingValue = "   ";
        expect(await siteCurrency()).toBe("USD");
    });

    it("refuses a value Intl cannot format, rather than passing it on", async () => {
        // Each of these throws a RangeError inside Intl.NumberFormat.
        for (const bad of ["us", "dollar", "€", "TL!", "12", "usd usd"]) {
            settingValue = bad;
            expect(await siteCurrency(), `"${bad}" must not reach Intl`).toBe("USD");
        }
    });

    it("formats a price without throwing, whatever the setting holds", async () => {
        for (const bad of ["us", "€", "", "dollar"]) {
            settingValue = bad;
            await expect(formatSiteCurrency(49.9, "tr")).resolves.toContain("49");
        }
    });

    it("still formats in a valid currency the site actually uses", async () => {
        settingValue = "TRY";
        const out = await formatSiteCurrency(49.9, "tr");
        expect(out).toMatch(/49/);
    });
});
