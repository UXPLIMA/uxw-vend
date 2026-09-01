import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Both routers resolve an incoming URL to a module by walking every
 * installed module's declared paths. A bug here is cross-module: the loop
 * that mis-resolves or throws is walking other modules' routes too.
 *
 * The API matcher used to build its own regex and turned a `[...rest]`
 * catch-all into the capture group `(?<...rest>…)`, which is not a legal
 * group name — `new RegExp` threw a SyntaxError out of that loop. Nothing
 * in the manifest schema forbids a catch-all under `api`; no first-party
 * module happened to declare one. Both matchers now share
 * `path-pattern.ts`, so they cannot drift apart again.
 */

let routes: { path: string; key: string; module: string; isAdmin?: boolean }[];
let apiRoutes: { path: string; key: string; module: string; method?: string }[];

vi.mock("@/core/generated/module-registry", () => ({
    get ModuleRoutes() { return routes; },
    get ModuleApiRoutes() { return apiRoutes; },
}));

beforeEach(() => {
    routes = [];
    apiRoutes = [];
});

async function matchRoute(path: string) {
    const { matchModuleRoute } = await import("@/core/lib/route-matcher");
    return matchModuleRoute(path.replace(/^\//, "").split("/"));
}

async function matchApi(path: string) {
    const { matchApiRoute } = await import("@/core/lib/api-matcher");
    return matchApiRoute(path.replace(/^\//, "").split("/"));
}

describe("matchPathPattern", () => {
    it("captures a single dynamic segment", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        expect(matchPathPattern("/blog/[slug]", "/blog/hello-world"))
            .toEqual({ params: { slug: "hello-world" } });
    });

    it("captures several dynamic segments in one pattern", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        expect(matchPathPattern("/store/[category]/[product]", "/store/shoes/runner"))
            .toEqual({ params: { category: "shoes", product: "runner" } });
    });

    it("does not let a dynamic segment swallow a slash", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        // Otherwise /blog/[slug] would claim /blog/a/b and shadow every
        // deeper route in every other module.
        expect(matchPathPattern("/blog/[slug]", "/blog/a/b")).toBeNull();
    });

    it("anchors at both ends", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        expect(matchPathPattern("/blog/[slug]", "/prefix/blog/x")).toBeNull();
        expect(matchPathPattern("/blog/[slug]", "/blog/x/suffix")).toBeNull();
    });

    it("joins a trailing catch-all into one parameter", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        expect(matchPathPattern("/blog/[...params]", "/blog/2026/09/hello"))
            .toEqual({ params: { params: "2026/09/hello" } });
        expect(matchPathPattern("/blog/[...params]", "/blog/one"))
            .toEqual({ params: { params: "one" } });
    });

    it("requires a catch-all to match at least one segment", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        expect(matchPathPattern("/blog/[...params]", "/blog")).toBeNull();
        expect(matchPathPattern("/blog/[...params]", "/blog/")).toBeNull();
    });

    it("escapes regex metacharacters in literal segments", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        // The manifest allowlist permits `.` and `*` in a path, so an
        // unescaped literal would match paths the module never declared.
        expect(matchPathPattern("/store/v1.0/[id]", "/store/v1X0/9")).toBeNull();
        expect(matchPathPattern("/store/v1.0/[id]", "/store/v1.0/9"))
            .toEqual({ params: { id: "9" } });
        expect(matchPathPattern("/a*/[id]", "/aaa/9")).toBeNull();
        expect(matchPathPattern("/a*/[id]", "/a*/9")).toEqual({ params: { id: "9" } });
    });

    it("returns null rather than throwing on a malformed pattern", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        // `[a-b]` passes the manifest path allowlist but is not a legal
        // capture group name.
        expect(() => matchPathPattern("/x/[a-b]", "/x/1")).not.toThrow();
        expect(matchPathPattern("/x/[a-b]", "/x/1")).toBeNull();
    });

    it("returns null for a catch-all that is not last", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        expect(matchPathPattern("/blog/[...rest]/edit", "/blog/a/b/edit")).toBeNull();
    });

    it("matches a fully static pattern", async () => {
        const { matchPathPattern } = await import("@/core/lib/path-pattern");
        expect(matchPathPattern("/blog", "/blog")).toEqual({ params: {} });
        expect(matchPathPattern("/blog", "/blogs")).toBeNull();
    });
});

describe("matchModuleRoute", () => {
    it("returns null when nothing is installed", async () => {
        expect(await matchRoute("/blog/hello")).toBeNull();
    });

    it("prefers an exact route over a dynamic one declared earlier", async () => {
        routes = [
            { path: "/blog/[slug]", key: "blog.article", module: "blog" },
            { path: "/blog/archive", key: "blog.archive", module: "blog" },
        ];

        // Declaration order in the generated registry is arbitrary; a static
        // route must never lose to a dynamic sibling.
        expect(await matchRoute("/blog/archive")).toEqual({
            key: "blog.archive", module: "blog", params: {},
        });
    });

    it("resolves a dynamic route to its module with params", async () => {
        routes = [{ path: "/blog/[slug]", key: "blog.article", module: "blog" }];

        expect(await matchRoute("/blog/hello-world")).toEqual({
            key: "blog.article", module: "blog", params: { slug: "hello-world" },
        });
    });

    it("resolves the catch-all routes the shipped modules actually declare", async () => {
        routes = [
            { path: "/blog/[...params]", key: "blog.page", module: "blog" },
            { path: "/forum/topic/[...params]", key: "forum.topic", module: "forum" },
        ];

        expect(await matchRoute("/forum/topic/12/general")).toEqual({
            key: "forum.topic", module: "forum", params: { params: "12/general" },
        });
    });

    it("keeps walking past a module whose pattern is malformed", async () => {
        routes = [
            { path: "/broken/[a-b]", key: "broken.x", module: "broken" },
            { path: "/blog/[slug]", key: "blog.article", module: "blog" },
        ];

        // One module's typo must not make every other module's pages 500.
        expect(await matchRoute("/blog/hello")).toEqual({
            key: "blog.article", module: "blog", params: { slug: "hello" },
        });
    });

    it("returns the first dynamic route that matches", async () => {
        routes = [
            { path: "/[first]", key: "a.page", module: "a" },
            { path: "/[second]", key: "b.page", module: "b" },
        ];

        expect(await matchRoute("/x")).toMatchObject({ module: "a" });
    });
});

describe("matchApiRoute", () => {
    it("returns null when no module declares the path", async () => {
        apiRoutes = [{ path: "/blog/articles", key: "blog.list", module: "blog" }];
        expect(await matchApi("/forum/topics")).toBeNull();
    });

    it("carries the declared HTTP method through an exact match", async () => {
        apiRoutes = [{ path: "/blog/articles", key: "blog.list", module: "blog", method: "GET" }];

        expect(await matchApi("/blog/articles")).toEqual({
            key: "blog.list", module: "blog", params: {}, method: "GET",
        });
    });

    it("carries the declared HTTP method through a dynamic match", async () => {
        apiRoutes = [{ path: "/blog/articles/[id]", key: "blog.get", module: "blog", method: "GET" }];

        expect(await matchApi("/blog/articles/42")).toEqual({
            key: "blog.get", module: "blog", params: { id: "42" }, method: "GET",
        });
    });

    it("resolves a catch-all instead of throwing a SyntaxError", async () => {
        apiRoutes = [{ path: "/proxy/[...rest]", key: "proxy.any", module: "proxy" }];

        // The old builder produced `(?<...rest>…)`, an illegal capture group
        // name, and `new RegExp` threw from inside the matching loop.
        expect(await matchApi("/proxy/a/b/c")).toEqual({
            key: "proxy.any", module: "proxy", params: { rest: "a/b/c" }, method: undefined,
        });
    });

    it("does not let one module's catch-all break another module's route", async () => {
        apiRoutes = [
            { path: "/proxy/[...rest]", key: "proxy.any", module: "proxy" },
            { path: "/blog/articles/[id]", key: "blog.get", module: "blog", method: "GET" },
        ];

        // This is the regression that mattered: the throw happened while
        // walking the list, so every route behind the offender was lost.
        expect(await matchApi("/blog/articles/42")).toMatchObject({ module: "blog" });
    });

    it("prefers an exact API route over a dynamic one", async () => {
        apiRoutes = [
            { path: "/blog/articles/[id]", key: "blog.get", module: "blog" },
            { path: "/blog/articles/featured", key: "blog.featured", module: "blog" },
        ];

        expect(await matchApi("/blog/articles/featured")).toMatchObject({ key: "blog.featured" });
    });

    it("does not let a dynamic API segment cross a slash", async () => {
        apiRoutes = [{ path: "/blog/articles/[id]", key: "blog.get", module: "blog" }];
        expect(await matchApi("/blog/articles/42/comments")).toBeNull();
    });
});
