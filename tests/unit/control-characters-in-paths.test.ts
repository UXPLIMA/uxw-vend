import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hasControlCharacter } from "@/core/lib/request-path";
import { oneLine } from "@/core/lib/logger";

/**
 * A control character has no meaning in a URL.
 *
 * Letting one through cost two things. next-intl's middleware strips a
 * trailing segment that is nothing but a control character, so `/en/%00`
 * answered 200 with the homepage and `/en/store/%00` with the store page:
 * every page on the site had an unbounded supply of URLs reporting 200 for
 * content that is not there. That is a soft 404 to a crawler and a false
 * green to a link checker or an uptime monitor.
 *
 * The second cost is the shape of the bug rather than its size. A layer that
 * strips a character while the gates match on the string that still carries
 * it is how a gate gets walked past, and `%0a` in a path forges a line in any
 * log that formats rather than encodes, which the development logger did.
 *
 * The query string had no rule at all, and paid a third cost. Postgres text
 * cannot hold a null byte, so a `%00` in any query value that reached a
 * Prisma string filter made the driver throw where the handler had nothing to
 * say: `/api/v1/punishments?search=%00` and `/api/v1/store/products?search=%00`
 * both answered 500, and every endpoint that passes a search term or a filter
 * into a query was another one. Refused at the edge rather than sanitised at
 * each of the dozens of places it can reach, because a control character is
 * not a search anyone typed.
 *
 * The characters are built rather than typed here, so this file stays one a
 * reviewer can read and a terminal can print.
 */

const ROOT = process.cwd();
const chr = (code: number) => String.fromCharCode(code);
const NUL = chr(0);
const LF = chr(10);
const CR = chr(13);
const TAB = chr(9);
const DEL = chr(127);

describe("hasControlCharacter", () => {
    it("catches the literal character", () => {
        for (const c of [NUL, chr(1), LF, CR, TAB, chr(31), DEL]) {
            expect(hasControlCharacter(`/en/${c}`)).toBe(true);
        }
    });

    it("catches the percent escape, in either case", () => {
        for (const esc of ["%00", "%01", "%0a", "%0A", "%0d", "%09", "%1f", "%1F", "%7f", "%7F"]) {
            expect(hasControlCharacter(`/en/store/${esc}`)).toBe(true);
        }
    });

    it("catches one in a query value, in either spelling", () => {
        for (const query of [
            "?search=%00", "?type=x%00y", "?q=%0a", "?q=%0A", "?sort=%09",
            `?search=${NUL}`, `?search=a${LF}b`, `?page=1&search=${DEL}`,
        ]) {
            expect(hasControlCharacter(query)).toBe(true);
        }
    });

    it("leaves an ordinary query alone", () => {
        for (const query of [
            "", "?page=2", "?search=hello%20world", "?type=ban&status=active",
            "?q=%C3%A9clair", "?callbackUrl=%2Fadmin%2Fmodules", "?q=50%25",
        ]) {
            expect(hasControlCharacter(query)).toBe(false);
        }
    });

    it("leaves ordinary paths alone", () => {
        for (const p of [
            "/", "/en", "/en/store", "/api/v1/store/products/clx123",
            "/en/blog/a-post-with-dashes", "/uploads/image.png",
            "/en/search%20term", "/tr/basvuru", "/en/%C3%A9clair",
            "/api/v1/store/products/1.", "/en/a%25b",
        ]) {
            expect(hasControlCharacter(p)).toBe(false);
        }
    });

    it("does not mistake a percent-escaped percent for an escape", () => {
        // %250a decodes to the text "%0a", not to a newline.
        expect(hasControlCharacter("/en/%250a")).toBe(false);
    });
});

describe("the proxy", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/proxy.ts"), "utf8");

    it("refuses a control character before any other gate runs", () => {
        const check = source.indexOf("hasControlCharacter(pathname)");
        expect(check).toBeGreaterThan(-1);
        // Each of these is the line where that gate acts, not where its
        // constants are declared, so the comparison is about run order.
        for (const laterGate of [
            "declaredLength > MAX_REQUEST_BYTES",
            "isBlockedInDemo(request.method, pathname)",
            "checkCsrf(request)",
            "getModuleForPath(pathname)",
            "await isSetupComplete()",
        ]) {
            expect(source.indexOf(laterGate), laterGate).toBeGreaterThan(check);
        }
    });

    it("answers JSON for an API path and plain text for a page", () => {
        const block = source.slice(
            source.indexOf("hasControlCharacter(pathname)"),
            source.indexOf("Absolute body ceiling"),
        );
        expect(block).toContain("invalid_path");
        expect(block).toContain("status: 400");
        expect(block).toContain("new NextResponse('Invalid path'");
    });

    it("holds the query to the same rule, before any handler reads it", () => {
        const check = source.indexOf("hasControlCharacter(request.nextUrl.search)");
        expect(check).toBeGreaterThan(-1);
        const block = source.slice(check, source.indexOf("Absolute body ceiling"));
        expect(block).toContain("invalid_query");
        expect(block).toContain("status: 400");
        expect(block).toContain("new NextResponse('Invalid query'");
        for (const laterGate of [
            "declaredLength > MAX_REQUEST_BYTES",
            "checkCsrf(request)",
            "getModuleForPath(pathname)",
        ]) {
            expect(source.indexOf(laterGate), laterGate).toBeGreaterThan(check);
        }
    });
});

describe("one log record is one line", () => {
    it("escapes a control character rather than emitting it", () => {
        expect(oneLine(`GET /en/${LF}INFO forged line`)).toBe("GET /en/\\x0aINFO forged line");
        expect(oneLine(`a${NUL}b`)).toBe("a\\x00b");
        expect(oneLine(`a${CR}${LF}b`)).toBe("a\\x0d\\x0ab");
    });

    it("leaves ordinary text untouched", () => {
        expect(oneLine("GET /en/store 200")).toBe("GET /en/store 200");
        expect(oneLine("basvuru gonderildi")).toBe("basvuru gonderildi");
    });

    it("is applied to every value the dev line interpolates", () => {
        const source = fs.readFileSync(path.join(ROOT, "src/core/lib/logger.ts"), "utf8");
        const devBranch = source.slice(
            source.indexOf("if (isDev) {"),
            source.indexOf("// Production: JSON lines"),
        );
        for (const field of ["entry.method", "entry.path"]) {
            expect(devBranch).toContain(`oneLine(${field})`);
        }
        expect(devBranch).toContain("oneLine(entry.message)");
    });
});
