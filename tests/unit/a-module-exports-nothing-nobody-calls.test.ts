/**
 * A module keeps no export that nothing in it calls.
 *
 * Five had accumulated. `getMinecraftHead` and `getMinecraftBody` were unused
 * variants of the avatar helper next to them. `SkeletonProductDetail` and
 * `SkeletonCategories` were loading states for screens that had stopped using
 * them. `getStripePublicKey` read a credential whose own neighbouring comment
 * said the module does not use it, which is the worst kind: a getter for a
 * secret nobody needs is an invitation to start needing it.
 *
 * They are cheap to leave and expensive to read. Every one of them looks like
 * a supported part of the module to the next person, and the copy of the
 * platform's TOTP code that sat unreachable in two-factor-auth until it had
 * fallen behind core's is what that costs when it is a security decision.
 *
 * Modules do not import each other, so a module's own files are the whole
 * search. What core reaches into is named by the manifest, and that counts as
 * a caller.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MODULES = "module-sources";

/** Names the framework calls; nothing in the module references them. */
const CALLED_BY_THE_FRAMEWORK = new Set([
    "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
    "default", "metadata", "generateMetadata", "revalidate", "dynamic",
]);

function sources(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sources(full, out);
        // .d.ts files declare hook payload shapes; they export no code.
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(full);
    }
    return out;
}

describe("a module exports nothing nobody calls", () => {
    const modules = fs
        .readdirSync(MODULES, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(MODULES, e.name, "module.json")))
        .map((e) => e.name);

    it("has modules to check", () => {
        expect(modules.length).toBeGreaterThan(70);
    });

    it("leaves no export unreached", () => {
        const orphans: string[] = [];
        for (const id of modules) {
            const base = path.join(MODULES, id);
            const manifest = fs.readFileSync(path.join(base, "module.json"), "utf8");
            const files = sources(base);
            const everything = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

            for (const file of files) {
                const source = fs.readFileSync(file, "utf8");
                for (const declared of source.matchAll(/export (?:async )?(?:function|const) (\w+)/g)) {
                    const name = declared[1];
                    if (CALLED_BY_THE_FRAMEWORK.has(name)) continue;
                    // The manifest naming it is core reaching in: a caller.
                    if (manifest.includes(name)) continue;
                    // Its own declaration is the one mention it always has.
                    const mentions = everything.match(new RegExp(`\\b${name}\\b`, "g"))?.length ?? 0;
                    if (mentions <= 1) {
                        const line = source.slice(0, declared.index).split("\n").length;
                        orphans.push(`${file}:${line} ${name}`);
                    }
                }
            }
        }
        expect(orphans).toEqual([]);
    });
});
