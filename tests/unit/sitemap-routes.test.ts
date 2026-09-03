import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    CORE_STATIC_ROUTES,
    DISALLOWED_PREFIXES,
    isCrawlable,
    staticModuleRoutes,
} from "@/core/lib/sitemap-routes";

const ROUTES = [
    { path: "/store", module: "store" },
    { path: "/store/cart", module: "store" },
    { path: "/player/[username]", module: "player-profiles" },
    { path: "/vote", module: "vote" },
    { path: "/admin/announcements", module: "announcements", isAdmin: true },
];

describe("isCrawlable", () => {
    it("rejects a disallowed prefix and the paths under it", () => {
        expect(isCrawlable("/auth")).toBe(false);
        expect(isCrawlable("/auth/login")).toBe(false);
        expect(isCrawlable("/admin/modules")).toBe(false);
    });

    it("accepts a path that merely starts with the same letters", () => {
        expect(isCrawlable("/apiaries")).toBe(true);
        expect(isCrawlable("/profiles-of-note")).toBe(true);
    });
});

describe("CORE_STATIC_ROUTES", () => {
    it("publishes nothing robots.txt disallows", () => {
        const blocked = CORE_STATIC_ROUTES.filter((r) => !isCrawlable(r.path));
        expect(blocked).toEqual([]);
    });
});

describe("staticModuleRoutes", () => {
    const enabled = { store: true, vote: true, "player-profiles": true, announcements: true };

    it("lists the static public pages of enabled modules", () => {
        expect(staticModuleRoutes(ROUTES, enabled)).toEqual(["/store", "/store/cart", "/vote"]);
    });

    it("skips a dynamic path, whose values only the module knows", () => {
        expect(staticModuleRoutes(ROUTES, enabled)).not.toContain("/player/[username]");
    });

    it("skips admin routes", () => {
        expect(staticModuleRoutes(ROUTES, enabled)).not.toContain("/admin/announcements");
    });

    it("skips a module that is installed but disabled", () => {
        expect(staticModuleRoutes(ROUTES, { ...enabled, store: false })).toEqual(["/vote"]);
    });

    it("returns nothing when no module is enabled", () => {
        expect(staticModuleRoutes(ROUTES, {})).toEqual([]);
    });

    it("deduplicates a path two modules both route", () => {
        const dupes = [
            { path: "/vote", module: "vote" },
            { path: "/vote", module: "vote" },
        ];
        expect(staticModuleRoutes(dupes, enabled)).toEqual(["/vote"]);
    });
});

describe("robots.txt and the sitemap", () => {
    const root = path.resolve(import.meta.dirname, "../..");

    it("read their lists from the same place", () => {
        const robots = fs.readFileSync(path.join(root, "src/app/robots.ts"), "utf8");
        const sitemap = fs.readFileSync(path.join(root, "src/app/sitemap.ts"), "utf8");
        expect(robots).toContain("DISALLOWED_PREFIXES");
        expect(sitemap).toContain("CORE_STATIC_ROUTES");
        expect(sitemap).toContain("staticModuleRoutes");
    });

    it("names every prefix robots.txt is meant to block", () => {
        expect([...DISALLOWED_PREFIXES]).toEqual(["/admin", "/api", "/auth", "/profile"]);
    });
});

describe("noindex routes", () => {
    const enabled = { store: true };
    const routes = [
        { path: "/store", module: "store" },
        { path: "/store/cart", module: "store", noindex: true },
    ];

    it("keeps a route the module marked noindex out of the sitemap", () => {
        expect(staticModuleRoutes(routes, enabled)).toEqual(["/store"]);
    });
});
