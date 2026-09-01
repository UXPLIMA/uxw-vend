import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { moduleManifestSchema } from "@/core/lib/module-manifest-schema";

const base = {
    id: "demo",
    name: "Demo",
    description: "A demo module",
    version: "1.0.0",
};

describe("moduleManifestSchema — compatibility contract", () => {
    it("accepts a bare dependency id (pre-contract manifests stay valid)", () => {
        const r = moduleManifestSchema.safeParse({ ...base, dependencies: ["store", "currency"] });
        expect(r.success).toBe(true);
    });

    it("accepts an id@range dependency", () => {
        const r = moduleManifestSchema.safeParse({
            ...base,
            dependencies: ["store@^1.2.0", "currency@>=1.0.0 <2.0.0", "credits"],
        });
        expect(r.success).toBe(true);
    });

    it("rejects a dependency whose range is unparseable", () => {
        const r = moduleManifestSchema.safeParse({ ...base, dependencies: ["store@not-a-range"] });
        expect(r.success).toBe(false);
        if (!r.success) {
            expect(r.error.issues[0].message).toMatch(/not a valid semver range/);
        }
    });

    it("rejects a dependency id that is not a slug", () => {
        for (const bad of ["../evil", "Store", "store/sub"]) {
            expect(moduleManifestSchema.safeParse({ ...base, dependencies: [bad] }).success, bad).toBe(false);
        }
    });

    it("applies the same grammar to conflicts", () => {
        expect(moduleManifestSchema.safeParse({ ...base, conflicts: ["other@^2.0.0"] }).success).toBe(true);
        expect(moduleManifestSchema.safeParse({ ...base, conflicts: ["other@??"] }).success).toBe(false);
    });

    it("accepts a valid coreVersion range and rejects a malformed one", () => {
        expect(moduleManifestSchema.safeParse({ ...base, coreVersion: "^1.0.0" }).success).toBe(true);
        expect(moduleManifestSchema.safeParse({ ...base, coreVersion: "1.x" }).success).toBe(true);
        expect(moduleManifestSchema.safeParse({ ...base, coreVersion: "latest" }).success).toBe(false);
        expect(moduleManifestSchema.safeParse({ ...base, coreVersion: "" }).success).toBe(false);
    });

    it("treats coreVersion as optional", () => {
        expect(moduleManifestSchema.safeParse(base).success).toBe(true);
    });

    it("accepts category and tags", () => {
        const r = moduleManifestSchema.safeParse({ ...base, category: "commerce", tags: ["shop", "payments"] });
        expect(r.success).toBe(true);
    });

    it("rejects a category that is not a lowercase slug", () => {
        expect(moduleManifestSchema.safeParse({ ...base, category: "Commerce" }).success).toBe(false);
    });
});

describe("moduleManifestSchema — scaffold template", () => {
    it("validates once create-module strips the _comment key", () => {
        // Guards the authoring path: `npm run create:module` copies this file
        // and deletes only `_comment`, so anything else the schema rejects here
        // means every scaffolded module starts out invalid.
        const raw = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), "module-template", "module.json"), "utf8"),
        );
        delete raw._comment;
        const r = moduleManifestSchema.safeParse(raw);
        if (!r.success) {
            throw new Error(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
        }
        expect(r.success).toBe(true);
    });

    it("imports core only through the SDK", () => {
        // The template is excluded from every tsconfig and from the marketplace
        // boundary scan, so nothing else notices when it drifts. A scaffolded
        // module that deep-imports fails `validate:module` on its first run.
        const root = path.join(process.cwd(), "module-template");
        const walk = (dir: string): string[] =>
            fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) return walk(full);
                return /\.tsx?$/.test(e.name) ? [full] : [];
            });

        const deepImport = /["']@\/core\/(lib|components)\/[^"']*["']/;
        const violations = walk(root).flatMap((file) =>
            fs
                .readFileSync(file, "utf8")
                .split("\n")
                .flatMap((line, i) =>
                    deepImport.test(line) ? [`${path.relative(root, file)}:${i + 1}`] : [],
                ),
        );
        expect(violations).toEqual([]);
    });
});

describe("hook contracts across the catalog", () => {
    const dir = path.join(process.cwd(), "module-sources");
    const ids = fs
        .readdirSync(dir)
        .filter((id) => fs.existsSync(path.join(dir, id, "module.json")))
        .sort();
    const manifests = ids.map((id) => ({
        id,
        m: JSON.parse(fs.readFileSync(path.join(dir, id, "module.json"), "utf8")) as {
            hooksEmitted?: { hook: string; type: string }[];
            hookListeners?: { hook: string; type: string }[];
        },
    }));

    const coreHookSource = [
        fs.readFileSync(path.join(process.cwd(), "src/core/lib/hooks.ts"), "utf8"),
        fs.readFileSync(path.join(process.cwd(), "src/core/types/hook-payloads.d.ts"), "utf8"),
        ...fs
            .readdirSync(path.join(process.cwd(), "src/core/lib"))
            .filter((f) => f.endsWith(".ts"))
            .map((f) => fs.readFileSync(path.join(process.cwd(), "src/core/lib", f), "utf8")),
    ].join("\n");
    const coreHooks = new Set(
        [...coreHookSource.matchAll(/"([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)"\s*[,:)]/g)].map((m) => m[1]),
    );

    it("every hook listener subscribes to a hook something emits", () => {
        // A listener on a hook nobody fires never runs, and nothing anywhere
        // reports it — not a log line, not a failed build. This is the only
        // check that catches a mistyped hook name.
        const emitted = new Set<string>();
        for (const { m } of manifests) {
            for (const h of m.hooksEmitted ?? []) emitted.add(h.hook);
        }

        const unresolved: string[] = [];
        for (const { id, m } of manifests) {
            for (const h of m.hookListeners ?? []) {
                if (!emitted.has(h.hook) && !coreHooks.has(h.hook)) {
                    unresolved.push(`${id} listens to "${h.hook}", which nothing emits`);
                }
            }
        }
        expect(unresolved).toEqual([]);
    });

    it("no two modules claim the same hook name", () => {
        // Two emitters for one name means two payload shapes behind one
        // contract, and whichever listener loads second silently wins.
        const owners = new Map<string, string>();
        const clashes: string[] = [];
        for (const { id, m } of manifests) {
            for (const h of m.hooksEmitted ?? []) {
                const existing = owners.get(h.hook);
                if (existing && existing !== id) clashes.push(`"${h.hook}": ${existing} and ${id}`);
                else owners.set(h.hook, id);
            }
        }
        expect(clashes).toEqual([]);
    });
});

describe("moduleManifestSchema — shipped manifests", () => {
    const dir = path.join(process.cwd(), "module-sources");
    const ids = fs
        .readdirSync(dir)
        .filter((id) => fs.existsSync(path.join(dir, id, "module.json")))
        .sort();

    it("finds the shipped module sources", () => {
        expect(ids.length).toBeGreaterThan(0);
    });

    it.each(ids)("%s validates against the current schema", (id) => {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, id, "module.json"), "utf8"));
        const r = moduleManifestSchema.safeParse(raw);
        if (!r.success) {
            throw new Error(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
        }
        expect(r.success).toBe(true);
    });
});
