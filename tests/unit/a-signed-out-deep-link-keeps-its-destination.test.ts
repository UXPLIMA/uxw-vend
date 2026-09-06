import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { safeInternalPath } from "@/core/lib/safe-redirect";

/**
 * An admin opens a bookmarked /admin/media, is asked to sign in, and lands on
 * the homepage. The destination was dropped at the redirect, so signing in
 * meant navigating back by hand.
 *
 * Carrying it costs something: a destination that arrives in a query string
 * arrives from whoever wrote the link, and a login form that follows one
 * blindly is an open redirect - the highest-value one on any site, because the
 * person following it has just typed their password.
 *
 * So this gate holds both halves. The destination survives the round trip, and
 * only a destination that points back at this site does.
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/** Spelled by code point so nothing here is a character a diff would swallow. */
const NEWLINE = String.fromCharCode(10);

describe("a destination that points back at this site is kept", () => {
    it.each([
        "/admin/media",
        "/admin/settings/alerting",
        "/profile",
        "/store/product/5/legendary-key",
        "/admin/users?page=3&sort=name",
        "/tr/forum",
    ])("keeps %s", (destination) => {
        expect(safeInternalPath(destination)).toBe(destination);
    });

    it("keeps the query string, which is half of where someone was", () => {
        expect(safeInternalPath("/admin/users?page=3")).toBe("/admin/users?page=3");
    });
});

describe("a destination that points anywhere else is refused", () => {
    it.each([
        ["a protocol-relative host", "//evil.example"],
        ["the same, with a backslash", String.raw`/\evil.example`],
        ["both backslashes", String.raw`\\evil.example`],
        ["an absolute URL", "https://evil.example/steal"],
        ["a scheme with no host", "javascript:alert(1)"],
        ["a bare host", "evil.example"],
        ["a relative climb", "../../etc/passwd"],
        ["a fragment", "#anchor"],
        ["nothing at all", ""],
        ["nothing at all, spelled null", null],
        ["nothing at all, spelled undefined", undefined],
    ])("refuses %s", (_why, destination) => {
        expect(safeInternalPath(destination)).toBeNull();
    });

    it("refuses a control character, on the same terms a request path does", () => {
        expect(safeInternalPath("/admin/" + NEWLINE + "media")).toBeNull();
        expect(safeInternalPath("/admin/%0amedia")).toBeNull();
    });

    it("refuses the login form itself, which would be a loop", () => {
        expect(safeInternalPath("/auth/login")).toBeNull();
        expect(safeInternalPath("/auth/login?callbackUrl=%2Fadmin")).toBeNull();
        expect(safeInternalPath("/auth/login/whatever")).toBeNull();
    });

    it("refuses a destination longer than any route on the site", () => {
        expect(safeInternalPath("/" + "a".repeat(512))).toBeNull();
    });

    it("judges the folded form, so a backslash cannot smuggle a host past it", () => {
        // `/\evil.example` starts with a single slash and does not start with
        // two, which is exactly what the check it replaced tested for.
        const naive = (href: string) => href.startsWith("/") && !href.startsWith("//");
        expect(naive(String.raw`/\evil.example`)).toBe(true);
        expect(safeInternalPath(String.raw`/\evil.example`)).toBeNull();
    });
});

describe("the redirect carries the destination", () => {
    const proxy = read("src/proxy.ts");

    it("sends a signed-out visitor on an admin page to the login form", () => {
        expect(proxy).toContain("/auth/login");
        expect(proxy).toContain("hasSessionCookie(request)");
    });

    it("writes the destination into the redirect, validated", () => {
        expect(proxy).toContain("safeInternalPath");
        expect(proxy).toContain("searchParams.set('callbackUrl'");
    });

    it("strips the locale, so the login form's router adds the visitor's own", () => {
        expect(proxy).toContain("pathname.slice(`/${locale}`.length)");
    });
});

describe("the login form honours the destination", () => {
    const login = read("src/app/[locale]/(auth)/auth/login/page.tsx");

    it("reads it from the query string", () => {
        expect(login).toContain('searchParams.get("callbackUrl")');
    });

    it("validates it before following it", () => {
        expect(login).toMatch(/safeInternalPath\(searchParams\.get\("callbackUrl"\)\)/);
    });

    it("falls back to the homepage rather than to a guess", () => {
        expect(login).toContain('?? "/"');
    });

    it("goes there after a successful sign-in, not to a hardcoded page", () => {
        expect(login).toContain("router.push(destination)");
        expect(login).not.toContain('router.push("/")');
    });

    it("hands the same destination to an OAuth provider, locale and all", () => {
        expect(login).toContain("signIn(btn.provider, { callbackUrl:");
        expect(login).not.toContain('signIn(btn.provider, { callbackUrl: "/" })');
    });

    it("puts the module-declared entry route through the same validator", () => {
        expect(login).toContain('safeInternalPath(btn.href ?? "")');
    });
});

describe("a client screen that bounces someone to the login form says where they were", () => {
    // The server-side guards are covered by the proxy gate above; these are
    // the screens that decide mid-session, when a token expires under someone
    // who is already reading a page.
    const BOUNCERS = [
        "src/app/[locale]/(public)/profile/page.tsx",
    ];

    it.each(BOUNCERS)("%s", (file) => {
        const source = read(file);
        const pushes = source.match(/router\.push\(\s*["'`]\/auth\/login[^)]*\)/g) ?? [];
        expect(pushes.length, `${file} no longer bounces anyone`).toBeGreaterThan(0);
        for (const push of pushes) {
            expect(push, file).toContain("callbackUrl");
        }
    });
});
