/**
 * Loading somebody else's chat widget onto every page.
 *
 * The embed is a script tag whose URL contains two ids an operator pasted from
 * the provider's dashboard. Those ids are path segments, and a path segment
 * that is not checked is a script-src injection: `../../evil.example/x.js`
 * pasted into the box, and arbitrary JavaScript runs on every page of the
 * site, inside the session, for every visitor. The content security policy
 * narrows where a script may come from and does nothing about which script
 * comes from there.
 *
 * "Only an admin can set it" is not the answer, for the same reason it was not
 * the answer for a table name: an admin session is one stolen cookie and the
 * setting is read on every page load afterwards.
 *
 * So the ids are refused unless they look like what the provider issues, and
 * the URL is only built from ids that passed.
 */
import { describe, it, expect } from "vitest";
import { embedUrl, safeEmbedId } from "@/modules/tawkto-chat/lib/embed";

describe("an id pasted from a dashboard", () => {
    it("is accepted when it is what the provider issues", () => {
        expect(safeEmbedId("65f3a1b2c9d4e5f6a7b8c9d0")).toBe("65f3a1b2c9d4e5f6a7b8c9d0");
        expect(safeEmbedId("1hq8k2p9j")).toBe("1hq8k2p9j");
    });

    it("is taken with the spaces somebody pasted around it", () => {
        expect(safeEmbedId("  1hq8k2p9j  ")).toBe("1hq8k2p9j");
    });

    it("is refused when it could climb out of the path", () => {
        for (const attempt of [
            "../../evil.example/x.js",
            "..%2f..%2fevil.example",
            "a/b",
            "a\\b",
            "a?b=1",
            "a#b",
            "a:b",
            "//evil.example",
        ]) {
            expect(safeEmbedId(attempt), attempt).toBeNull();
        }
    });

    it("is refused when it is empty, or long enough to be something else", () => {
        expect(safeEmbedId("")).toBeNull();
        expect(safeEmbedId("   ")).toBeNull();
        expect(safeEmbedId("a".repeat(100))).toBeNull();
    });
});

describe("the script URL", () => {
    it("is built only from ids that passed", () => {
        expect(embedUrl("65f3a1b2c9d4e5f6a7b8c9d0", "1hq8k2p9j"))
            .toBe("https://embed.tawk.to/65f3a1b2c9d4e5f6a7b8c9d0/1hq8k2p9j");
    });

    it("is nothing at all when either id is not one", () => {
        // Null, not a URL with a hole in it: a script tag pointing at
        // `https://embed.tawk.to//` is a request nobody meant to make.
        expect(embedUrl("../../evil.example/x.js", "1hq8k2p9j")).toBeNull();
        expect(embedUrl("65f3a1b2c9d4e5f6a7b8c9d0", "")).toBeNull();
        expect(embedUrl("", "")).toBeNull();
    });

    it("always points at the provider, whatever was typed", () => {
        const built = embedUrl("65f3a1b2c9d4e5f6a7b8c9d0", "1hq8k2p9j");
        expect(built?.startsWith("https://embed.tawk.to/")).toBe(true);
    });
});
