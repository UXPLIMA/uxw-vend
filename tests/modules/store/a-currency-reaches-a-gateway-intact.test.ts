/**
 * What the store hands a payment gateway when the setting is wrong.
 *
 * Core stopped a mistyped `default_currency` from throwing inside a price
 * render, but three routes in this module read that setting themselves and
 * pass it on: the checkout prices an order in it, the credit purchase charges
 * in it, and the provider list asks the gateways which of them can take it.
 * None of them checked it, so "us" or "dollar" travelled to a payment
 * provider, where the failure is a refused charge rather than a stack trace.
 *
 * The provider list is worse in one respect: it prefers a currency from the
 * query string, so the value is not merely mistyped, it is chosen by whoever
 * called the endpoint.
 *
 * `resolveCurrency` is the one answer all three need: an ISO 4217 code, or
 * the fallback, never anything else.
 */
import { describe, it, expect } from "vitest";
import { resolveCurrency } from "@/modules/store/lib/currency";

describe("resolving a currency for a gateway", () => {
    it("keeps a valid code and normalises its case", () => {
        expect(resolveCurrency("TRY")).toBe("TRY");
        expect(resolveCurrency("try")).toBe("TRY");
        expect(resolveCurrency("  eur  ")).toBe("EUR");
    });

    it("falls back on anything a gateway could not use", () => {
        for (const bad of ["us", "dollar", "€", "TL!", "12", "usd usd", "", "   "]) {
            expect(resolveCurrency(bad), `"${bad}" must not reach a gateway`).toBe("USD");
        }
    });

    it("falls back on a value that is not a string at all", () => {
        expect(resolveCurrency(null)).toBe("USD");
        expect(resolveCurrency(undefined)).toBe("USD");
        expect(resolveCurrency(42 as unknown as string)).toBe("USD");
    });

    it("prefers the first usable value and ignores the rest", () => {
        // The provider list asks for a requested currency first, then the
        // configured one. A requested value that is junk must not win.
        expect(resolveCurrency("nonsense", "TRY")).toBe("TRY");
        expect(resolveCurrency("EUR", "TRY")).toBe("EUR");
        expect(resolveCurrency(null, null)).toBe("USD");
    });

    it("never returns something Intl would refuse", () => {
        // The whole point: whatever comes back can be formatted.
        for (const input of ["us", "dollar", "TRY", "", "xx"]) {
            const out = resolveCurrency(input);
            expect(() => new Intl.NumberFormat("en", { style: "currency", currency: out }).format(1)).not.toThrow();
        }
    });
});
