// @vitest-environment node
/**
 * "Is there a session cookie" is a question about a cookie's name.
 *
 * The proxy answered it with `cookieHeader.includes('authjs.session-token')`,
 * which is also true of a cookie whose *value* happens to contain that text -
 * and a visitor chooses their own cookie values. What it costs today is small:
 * the only caller that can be fooled skips a redirect to the login page, and
 * the admin page behind it does its own `auth()` check and redirects anyway.
 *
 * It is worth fixing because of what the function claims rather than what it
 * currently costs. A helper whose name promises one thing and whose body
 * answers another is a trap for the next caller, who will reasonably believe
 * the name.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { carriesSessionCookie } from "@/core/lib/session-cookie";

describe("carriesSessionCookie", () => {
    it("sees the cookie Auth.js sets", () => {
        expect(carriesSessionCookie("authjs.session-token=abc123")).toBe(true);
    });

    it("sees it among others", () => {
        expect(carriesSessionCookie("theme=dark; authjs.session-token=abc123; locale=tr")).toBe(true);
    });

    it("sees the prefixed names a browser gets over https", () => {
        expect(carriesSessionCookie("__Secure-authjs.session-token=abc")).toBe(true);
        expect(carriesSessionCookie("__Host-authjs.session-token=abc")).toBe(true);
    });

    it("still sees the name Auth.js used before it was renamed", () => {
        expect(carriesSessionCookie("next-auth.session-token=abc")).toBe(true);
        expect(carriesSessionCookie("__Secure-next-auth.session-token=abc")).toBe(true);
    });

    it("is not fooled by a value the visitor chose", () => {
        expect(carriesSessionCookie("tracking=authjs.session-token")).toBe(false);
        expect(carriesSessionCookie("ref=https://x.test/?u=next-auth.session-token")).toBe(false);
    });

    it("is not fooled by a name that merely contains it", () => {
        expect(carriesSessionCookie("not-authjs.session-token-really=abc")).toBe(false);
    });

    it("says no to a cookie that is there but empty, which is how a sign-out looks", () => {
        expect(carriesSessionCookie("authjs.session-token=")).toBe(false);
        expect(carriesSessionCookie("authjs.session-token=; theme=dark")).toBe(false);
    });

    it("says no when there is no cookie header at all", () => {
        expect(carriesSessionCookie("")).toBe(false);
        expect(carriesSessionCookie(null)).toBe(false);
    });

    it("copes with the spacing a client chooses", () => {
        expect(carriesSessionCookie("theme=dark;authjs.session-token=abc")).toBe(true);
        expect(carriesSessionCookie("  authjs.session-token=abc  ")).toBe(true);
    });
});

describe("the proxy", () => {
    const source = fs.readFileSync(
        path.resolve(import.meta.dirname, "../../src/proxy.ts"),
        "utf8",
    );

    it("asks this question here rather than reading the header itself", () => {
        expect(source).toContain("carriesSessionCookie");
        // The shape that made a cookie value answer for a cookie name.
        expect(source).not.toMatch(/cookieHeader\.includes\(/);
    });
});
