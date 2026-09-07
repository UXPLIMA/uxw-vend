import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * An export is a promise that something out there needs this.
 *
 * `src/core/lib` had ten that nothing did. Eight were used only inside the
 * file that declared them, so the `export` widened core's surface for no
 * reader. Two were not used at all: `isValidSlotName`, and
 * `requireCsrfOrRespond`, a helper for a check the proxy has done centrally
 * for a long time, kept alive only by the example in its own doc comment.
 *
 * The cost is not bytes. An exported name is something the next person has to
 * assume is called from somewhere they have not read, and a security helper
 * that looks available but is used by nothing is worse than that: it reads
 * like the thing that protects an endpoint.
 *
 * What `@/core/sdk` re-exports is deliberately out of scope. That is the
 * surface modules are written against, and removing a name from it is a major
 * CORE_API_VERSION bump rather than a tidy up.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

/** `export const`, `export function`, `export class`. Types are not values. */
const VALUE_EXPORT = /^export\s+(?:async\s+)?(?:const|function|class)\s+([A-Za-z_$][\w$]*)/gm;

function tsFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === "generated") continue;
            tsFiles(full, out);
        } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
            out.push(full);
        }
    }
    return out;
}

describe("what src/core/lib exports", () => {
    it("is imported by something", () => {
        const lib = tsFiles(path.join(ROOT, "src/core/lib")).filter((f) => !f.endsWith(".test.ts"));
        const consumers = ["src", "module-sources", "scripts", "tests"].flatMap((d) =>
            tsFiles(path.join(ROOT, d)),
        );
        const text = new Map(consumers.map((f) => [f, fs.readFileSync(f, "utf8")]));
        const sdk = tsFiles(path.join(ROOT, "src/core/sdk"))
            .map((f) => fs.readFileSync(f, "utf8"))
            .join("\n");

        const orphans: string[] = [];
        for (const file of lib) {
            const source = text.get(file) ?? fs.readFileSync(file, "utf8");
            for (const match of source.matchAll(VALUE_EXPORT)) {
                const name = match[1];
                const word = new RegExp(`\\b${name}\\b`);
                if (word.test(sdk)) continue;
                const used = [...text.entries()].some(
                    ([f, body]) => f !== file && word.test(body),
                );
                if (!used) orphans.push(`${path.relative(ROOT, file)} exports ${name}`);
            }
        }

        expect(
            orphans,
            `nothing outside the declaring file imports these. Drop the export, or delete the code if nothing calls it at all:\n${orphans.join("\n")}`,
        ).toEqual([]);
    });
});
