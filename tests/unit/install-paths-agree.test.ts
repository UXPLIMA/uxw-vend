/**
 * Installing a module one at a time and installing ten at once must leave
 * the same thing behind.
 *
 * They did not. The single install called `syncModuleTranslations`, which
 * writes the manifest's strings into the Translation table - the one place
 * the app reads them from. Bulk install called a local `mergeTranslations`
 * that wrote JSON files into a `messages/` directory at the project root.
 * That directory does not exist: core keeps its own catalogue in
 * `messages-core/` and everything else in the table. Every write threw
 * ENOENT straight into a `catch { /* skip *\/ }`, so a module installed
 * through the bulk path arrived with no strings at all and rendered raw keys
 * like `store.adm_products` on every one of its pages.
 *
 * Nothing failed, nothing logged, and installing the same module singly
 * worked - which is the shape of bug that survives a long time.
 *
 * This gate does not try to prove the two routes are equivalent. It pins the
 * three things that must not diverge again: both seed through the same
 * function, neither writes to a directory that is not there, and a swallowed
 * error never stands in for a filesystem the code assumed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "../..");
const SINGLE = "src/app/api/v1/modules/marketplace/install/route.ts";
const BULK = "src/app/api/v1/modules/marketplace/bulk-install/route.ts";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

describe("the two install routes", () => {
    it("both seed translations through the Translation table", () => {
        for (const rel of [SINGLE, BULK]) {
            expect(read(rel), `${rel} should call syncModuleTranslations`).toContain(
                "syncModuleTranslations",
            );
        }
    });

    it("neither writes a module's strings to a JSON file", () => {
        const offenders: string[] = [];
        for (const rel of [SINGLE, BULK]) {
            const source = read(rel);
            for (const m of source.matchAll(/path\.join\([^)]*["']messages["']\)/g)) {
                offenders.push(`${rel}: ${m[0]}`);
            }
        }
        expect(
            offenders,
            `The message catalogue is messages-core/ plus the Translation ` +
                `table. A "messages/" directory has never existed:\n${offenders.join("\n")}`,
        ).toEqual([]);
    });

    it("keeps no reference to a directory that is not in the repository", () => {
        expect(existsSync(join(ROOT, "messages"))).toBe(false);
        expect(existsSync(join(ROOT, "messages-core"))).toBe(true);
    });

    it("both validate the manifest before they keep it", () => {
        for (const rel of [SINGLE, BULK]) {
            expect(read(rel), `${rel} should parse with the manifest schema`).toContain(
                "moduleManifestSchema.safeParse",
            );
        }
    });

    it("both register the module in the same table", () => {
        for (const rel of [SINGLE, BULK]) {
            expect(read(rel), `${rel} should upsert moduleConfig`).toMatch(
                /prisma\.moduleConfig\.(upsert|create)/,
            );
        }
    });
});
