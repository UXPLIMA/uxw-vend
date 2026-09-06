import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    pageParams,
    MAX_PAGE,
    MAX_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
} from "../../src/core/lib/page-params";

/**
 * A page number has a floor and a ceiling.
 *
 * Sixteen list endpoints had written the same two lines in six wordings, and
 * every one of them clamped from below only. `?page=99999999999999999999`
 * parses to 1e20, survives `Math.max(1, ...)`, and reaches
 * `skip: (page - 1) * limit` - past what the 32-bit integer Postgres takes for
 * an OFFSET can hold. The driver refused it and threw where the handler had
 * nothing to say, so a number in a query string answered 500.
 *
 * It was live: `/api/v1/punishments?page=99999999999999999999` and
 * `/api/v1/store/products` with the same query both did it, and the other
 * fourteen would have. Nothing about the request was unusual except one
 * number, and no amount of reading a single route showed it, because each
 * route's own two lines looked complete.
 *
 * One helper now, on the SDK so a module can use it too, and this gate keeps
 * every list on it: a route that reads `page` from a query string does not
 * get to parse it itself.
 */

const ROOT = process.cwd();
const SCANNED = ["src/app/api", "module-sources"];

/**
 * A route reading a page number out of the query for itself. Any name ending
 * in "page": the forum's topic view pages its posts with `postsPage`, and
 * that one overflowed the same OFFSET.
 */
const HAND_ROLLED = /searchParams\.get\("\w*[Pp]age"\)/;

function routeFiles(dir: string, out: string[] = []): string[] {
    if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
    for (const entry of fs.readdirSync(dir)) {
        if (entry === "node_modules") continue;
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) routeFiles(full, out);
        else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
}

describe("pageParams", () => {
    const of = (query: string) => new URLSearchParams(query);

    it("defaults to the first page at the default size", () => {
        expect(pageParams(of(""))).toEqual({
            page: 1,
            limit: DEFAULT_PAGE_SIZE,
            skip: 0,
            take: DEFAULT_PAGE_SIZE,
        });
    });

    it("keeps a page a caller can actually be on", () => {
        expect(pageParams(of("page=3&limit=10")).skip).toBe(20);
        expect(pageParams(of("page=3&limit=10")).take).toBe(10);
    });

    it("gives an OFFSET no page number can overflow", () => {
        for (const query of [
            "page=99999999999999999999",
            "page=1e309",
            `page=${Number.MAX_SAFE_INTEGER}`,
            "page=99999999999999999999&limit=100",
        ]) {
            const { page, skip } = pageParams(of(query));
            expect(page).toBeLessThanOrEqual(MAX_PAGE);
            // What Postgres takes for an OFFSET.
            expect(skip).toBeLessThan(2_147_483_647);
        }
    });

    it("still has its floor", () => {
        for (const query of ["page=0", "page=-3", "page=abc", "page="]) {
            expect(pageParams(of(query)).page).toBe(1);
        }
    });

    it("caps the page size and refuses a nonsense one", () => {
        expect(pageParams(of("limit=99999")).limit).toBe(MAX_PAGE_SIZE);
        expect(pageParams(of("limit=0")).limit).toBe(DEFAULT_PAGE_SIZE);
        expect(pageParams(of("limit=-5")).limit).toBe(DEFAULT_PAGE_SIZE);
        expect(pageParams(of("limit=abc")).limit).toBe(DEFAULT_PAGE_SIZE);
        expect(pageParams(of("limit=7")).limit).toBe(7);
    });

    it("takes a screen's own page size and a caller's within it", () => {
        expect(pageParams(of(""), { defaultLimit: 12 }).limit).toBe(12);
        expect(pageParams(of("limit=30"), { defaultLimit: 12 }).limit).toBe(30);
        expect(pageParams(of("limit=30"), { defaultLimit: 12, maxLimit: 20 }).limit).toBe(20);
    });

    it("lets a screen fix a page size the caller cannot move", () => {
        expect(pageParams(of("limit=99"), { fixedLimit: 50 }).limit).toBe(50);
        expect(pageParams(of("page=2&limit=99"), { fixedLimit: 50 }).skip).toBe(50);
    });

    it("reads a second list's page from its own parameter", () => {
        const query = of("page=4&postsPage=99999999999999999999");
        const posts = pageParams(query, { pageParam: "postsPage", fixedLimit: 20 });
        expect(posts.page).toBe(MAX_PAGE);
        expect(posts.skip).toBeLessThan(2_147_483_647);
        // And the other list on the same screen is unaffected.
        expect(pageParams(query).page).toBe(4);
    });
});

describe("every list reads its page through the one door", () => {
    const offenders: string[] = [];
    for (const dir of SCANNED) {
        for (const file of routeFiles(path.join(ROOT, dir))) {
            const source = fs.readFileSync(file, "utf8");
            if (!HAND_ROLLED.test(source)) continue;
            if (source.includes("pageParams(")) continue;
            offenders.push(path.relative(ROOT, file));
        }
    }

    it("leaves no route parsing the page number itself", () => {
        expect(offenders, offenders.join("\n")).toEqual([]);
    });

    it("has routes to be talking about", () => {
        const users = SCANNED.flatMap((dir) => routeFiles(path.join(ROOT, dir))).filter((f) =>
            fs.readFileSync(f, "utf8").includes("pageParams("),
        );
        expect(users.length).toBeGreaterThan(10);
    });
});
