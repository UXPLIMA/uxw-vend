// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { manifestRefCandidates } from "@/core/lib/module-manifest-schema";
import { checkManifestFileRefs } from "@/core/lib/module-ref-resolver";
import type { ValidatedModuleManifest } from "@/core/lib/module-manifest-schema";

/**
 * The bug these cover: the install/upload/update routes compared a manifest
 * ref to the disk verbatim, so `components/Foo` was "missing" while
 * `components/Foo.tsx` sat next to it — the extensionless form the registry
 * generator strips every ref down to. Fourteen of forty-two first-party
 * modules were un-installable because of it.
 */

let root = "";

function touch(rel: string) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, "export default null;\n");
}

function manifest(over: Record<string, unknown>): ValidatedModuleManifest {
    return { id: "demo", name: "Demo", version: "1.0.0", ...over } as unknown as ValidatedModuleManifest;
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ref-resolver-"));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe("manifestRefCandidates", () => {
    it("tries the literal path first so a ref that carries its extension still wins", () => {
        expect(manifestRefCandidates("components/Foo.tsx")[0]).toBe("components/Foo.tsx");
    });

    it("appends every extension the bundler would resolve", () => {
        const c = manifestRefCandidates("components/Foo");
        for (const ext of [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"]) {
            expect(c).toContain(`components/Foo${ext}`);
        }
    });

    it("offers index files inside a directory of the same name", () => {
        expect(manifestRefCandidates("components/Foo")).toContain("components/Foo/index.tsx");
    });

    it("strips a leading ./ and a trailing slash", () => {
        const c = manifestRefCandidates("./components/Foo/");
        expect(c).toContain("components/Foo.tsx");
        expect(c.some((x) => x.startsWith("./"))).toBe(false);
    });

    it("treats an extension-carrying ref and its bare form as the same file", () => {
        const withExt = new Set(manifestRefCandidates("api/route.ts"));
        expect(withExt.has("api/route.tsx")).toBe(true);
        expect(withExt.has("api/route.ts")).toBe(true);
    });

    it("returns no duplicates", () => {
        const c = manifestRefCandidates("components/Foo.tsx");
        expect(c.length).toBe(new Set(c).size);
    });
});

describe("checkManifestFileRefs", () => {
    it("accepts an extensionless ref backed by a .tsx file — the case that broke 14 modules", () => {
        touch("components/BlogNewsSection.tsx");
        const res = checkManifestFileRefs(root, manifest({
            homepageSections: [{ id: "s", component: "components/BlogNewsSection" }],
        }));
        expect(res).toEqual({ escaping: [], missing: [] });
    });

    it("accepts a ref that already carries its extension", () => {
        touch("api/articles/route.ts");
        const res = checkManifestFileRefs(root, manifest({
            api: [{ path: "/articles", handler: "api/articles/route.ts" }],
        }));
        expect(res.missing).toEqual([]);
    });

    it("accepts a directory with an index file", () => {
        touch("widgets/stats/index.tsx");
        const res = checkManifestFileRefs(root, manifest({
            widgets: [{ id: "w", component: "widgets/stats" }],
        }));
        expect(res.missing).toEqual([]);
    });

    it("reports a ref with no file behind it under any extension", () => {
        const res = checkManifestFileRefs(root, manifest({
            widgets: [{ id: "w", component: "widgets/nope" }],
        }));
        expect(res.missing).toEqual(["widgets/nope"]);
        expect(res.escaping).toEqual([]);
    });

    it("does not accept a directory that only exists as a directory", () => {
        fs.mkdirSync(path.join(root, "components/Foo"), { recursive: true });
        const res = checkManifestFileRefs(root, manifest({
            widgets: [{ id: "w", component: "components/Foo" }],
        }));
        expect(res.missing).toEqual(["components/Foo"]);
    });

    it("flags a ref that climbs out of the module root", () => {
        const res = checkManifestFileRefs(root, manifest({
            widgets: [{ id: "w", component: "../../src/core/lib/db" }],
        }));
        expect(res.escaping).toEqual(["../../src/core/lib/db"]);
        expect(res.missing).toEqual([]);
    });

    it("flags an absolute ref even when that file exists", () => {
        const res = checkManifestFileRefs(root, manifest({
            widgets: [{ id: "w", component: "/etc/hostname" }],
        }));
        expect(res.escaping).toEqual(["/etc/hostname"]);
    });

    it("does not let an appended extension smuggle a ref past the escape check", () => {
        const res = checkManifestFileRefs(root, manifest({
            widgets: [{ id: "w", component: "../sibling/Thing" }],
        }));
        expect(res.escaping).toEqual(["../sibling/Thing"]);
    });

    it("covers refs on every manifest key, not just component-shaped ones", () => {
        touch("cron/tick.ts");
        touch("search/handler.ts");
        touch("hooks/on-enable.ts");
        touch("seo/sitemap.ts");
        const res = checkManifestFileRefs(root, manifest({
            cronJobs: [{ id: "c", schedule: "* * * * *", handler: "cron/tick" }],
            searchProviders: [{ id: "s", handler: "search/handler" }],
            hooks: { onEnable: "hooks/on-enable" },
            seoRoutes: { handler: "seo/sitemap" },
        }));
        expect(res).toEqual({ escaping: [], missing: [] });
    });

    it("reports every missing ref, not only the first", () => {
        const res = checkManifestFileRefs(root, manifest({
            widgets: [{ id: "a", component: "a" }, { id: "b", component: "b" }],
        }));
        expect(res.missing).toEqual(["a", "b"]);
    });

    it("deduplicates a ref named twice", () => {
        const res = checkManifestFileRefs(root, manifest({
            widgets: [{ id: "a", component: "shared" }],
            homepageSections: [{ id: "b", component: "shared" }],
        }));
        expect(res.missing).toEqual(["shared"]);
    });
});
