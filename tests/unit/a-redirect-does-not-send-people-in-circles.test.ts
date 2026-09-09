/**
 * Moving a page and leaving a sign on the old door.
 *
 * An operator renames a page, and every link to the old address on every forum
 * and search engine in the world still points at it. A redirect is the sign,
 * and it has three ways of going wrong that nobody notices from the admin
 * screen, because the screen shows exactly what was typed.
 *
 * The first is a circle. `/a` to `/b` and `/b` back to `/a` is two rules that
 * each look right on their own; a browser follows them twenty times and gives
 * up with an error page. It has to be answered here, where both rules are
 * visible, rather than by the visitor's browser.
 *
 * The second is an open redirect. A target that is not obviously a page of
 * ours - `//evil.example`, or a scheme somebody pasted - turns the site into a
 * redirector for whoever asks: a link that starts on a domain a visitor trusts
 * and ends somewhere else. So an internal target is checked the same way every
 * other destination on this site is checked, and going elsewhere has to be
 * said out loud with a whole https address.
 *
 * The resolver lives in core rather than in the module that manages the
 * rules: a redirect has to be decided in the proxy, before anything renders,
 * and a module cannot reach in there. Core asks whoever is installed for the
 * rules and never learns who answered.
 *
 * The third is the locale. Every page here is served under `/en` or `/tr`, and
 * an operator who moved `/pricing` means both of them. A rule that only worked
 * for the language they happened to be reading is a rule they will write twice
 * and fix once.
 */
import { describe, it, expect } from "vitest";
import { resolveRedirect } from "@/core/lib/redirect-resolve";

const rules = [
    { from: "/old-pricing", to: "/pricing", permanent: true },
    { from: "/promo", to: "https://partner.example/offer", permanent: false },
];

describe("a path with a sign on it", () => {
    it("sends the visitor where the operator said", () => {
        expect(resolveRedirect("/en/old-pricing", "en", rules)).toEqual({
            to: "/en/pricing",
            permanent: true,
        });
    });

    it("keeps the language the visitor was reading in", () => {
        expect(resolveRedirect("/tr/old-pricing", "tr", rules)).toEqual({
            to: "/tr/pricing",
            permanent: true,
        });
    });

    it("matches whether or not the address ends in a slash", () => {
        expect(resolveRedirect("/en/old-pricing/", "en", rules)?.to).toBe("/en/pricing");
    });

    it("matches whatever case it was typed in", () => {
        expect(resolveRedirect("/en/Old-Pricing", "en", rules)?.to).toBe("/en/pricing");
    });

    it("leaves a path nobody moved alone", () => {
        expect(resolveRedirect("/en/pricing", "en", rules)).toBeNull();
    });
});

describe("a target somewhere else entirely", () => {
    it("is allowed when it is a whole https address", () => {
        expect(resolveRedirect("/en/promo", "en", rules)).toEqual({
            to: "https://partner.example/offer",
            permanent: false,
        });
    });

    it("is refused when it only looks like a path", () => {
        // `//evil.example` is a protocol-relative URL: a browser reads it as
        // another site, and the operator reads it as a path.
        const sneaky = [{ from: "/x", to: "//evil.example", permanent: true }];
        expect(resolveRedirect("/en/x", "en", sneaky)).toBeNull();
    });

    it("is refused for a backslash, which a browser folds into a slash", () => {
        const folded = [{ from: "/x", to: "/\\evil.example", permanent: true }];
        expect(resolveRedirect("/en/x", "en", folded)).toBeNull();
    });

    it("is refused for a scheme that is not https", () => {
        for (const to of ["http://evil.example", "javascript:alert(1)", "data:text/html,x"]) {
            expect(resolveRedirect("/en/x", "en", [{ from: "/x", to, permanent: true }]), to).toBeNull();
        }
    });
});

describe("a circle", () => {
    it("is not followed when a rule points at itself", () => {
        const loop = [{ from: "/a", to: "/a", permanent: true }];
        expect(resolveRedirect("/en/a", "en", loop)).toBeNull();
    });

    it("is not followed when two rules point at each other", () => {
        const loop = [
            { from: "/a", to: "/b", permanent: true },
            { from: "/b", to: "/a", permanent: true },
        ];
        expect(resolveRedirect("/en/a", "en", loop)).toBeNull();
        expect(resolveRedirect("/en/b", "en", loop)).toBeNull();
    });

    it("follows a chain that ends somewhere", () => {
        // Three moves over three years is a chain, not a mistake.
        const chain = [
            { from: "/a", to: "/b", permanent: true },
            { from: "/b", to: "/c", permanent: true },
        ];
        expect(resolveRedirect("/en/a", "en", chain)).toEqual({ to: "/en/c", permanent: true });
    });

    it("gives up on a chain longer than anybody meant to write", () => {
        const long = Array.from({ length: 30 }, (_, i) => ({
            from: `/s${i}`,
            to: `/s${i + 1}`,
            permanent: true,
        }));
        expect(resolveRedirect("/en/s0", "en", long)).toBeNull();
    });
});

describe("what the visitor was carrying", () => {
    it("keeps the query string, because it is theirs", () => {
        expect(resolveRedirect("/en/old-pricing?ref=forum", "en", rules)?.to)
            .toBe("/en/pricing?ref=forum");
    });

    it("keeps it on the way somewhere else too", () => {
        expect(resolveRedirect("/en/promo?ref=forum", "en", rules)?.to)
            .toBe("https://partner.example/offer?ref=forum");
    });
});
