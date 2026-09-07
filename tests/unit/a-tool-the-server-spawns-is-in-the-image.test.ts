import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A binary the server spawns is installed in the image that runs the server.
 *
 * The runtime stage is `node:24-alpine` with nothing added, and the backup
 * feature spawns `pg_dump` and `psql`. Nothing failed at build time, nothing
 * failed at boot, and nothing failed on any page: the scheduled job simply
 * recorded `spawn pg_dump ENOENT` once a day, and the admin backup screen
 * could neither take a backup nor restore one. It shipped that way because no
 * gate connects "the code spawns this" to "the image contains this".
 *
 * The map below is that connection. Spawning a new binary means naming the
 * package that provides it here, and putting that package in the Dockerfile.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Binary the server spawns -> the Alpine package that provides it. */
const PROVIDED_BY: Record<string, string> = {
    pg_dump: "postgresql18-client",
    psql: "postgresql18-client",
};

/** Every string literal handed to `spawn(...)` as its command, across src. */
function spawnedBinaries(): { binary: string; where: string }[] {
    const found: { binary: string; where: string }[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "generated") continue;
                walk(full);
            } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
                const source = fs.readFileSync(full, "utf8");
                for (const m of source.matchAll(/\bspawn(?:Sync)?\(\s*["']([^"']+)["']/g)) {
                    found.push({ binary: m[1], where: path.relative(ROOT, full) });
                }
            }
        }
    };
    walk(path.join(ROOT, "src"));
    return found;
}

/** The packages the runtime stage installs with apk. */
function runtimePackages(): string[] {
    const dockerfile = fs.readFileSync(path.join(ROOT, "Dockerfile"), "utf8");
    // Everything from the last `FROM ... AS runner` onwards is what ships.
    const stages = dockerfile.split(/^FROM .*$/m);
    const runner = stages[stages.length - 1];
    const packages: string[] = [];
    for (const m of runner.matchAll(/apk add(?:\s+--[\w-]+)*\s+([^\n&]+)/g)) {
        packages.push(...m[1].trim().split(/\s+/));
    }
    return packages;
}

describe("a binary the server spawns", () => {
    const spawned = spawnedBinaries();

    it("is spawned by name somewhere, so this guard has something to check", () => {
        expect(spawned.length).toBeGreaterThan(0);
    });

    it("names the package that provides it", () => {
        const unmapped = spawned
            .filter(({ binary }) => !(binary in PROVIDED_BY))
            .map(({ binary, where }) => `${binary} (${where})`);
        expect(
            [...new Set(unmapped)],
            "add the binary to PROVIDED_BY with the package that ships it",
        ).toEqual([]);
    });

    it("has that package installed in the image that runs it", () => {
        const installed = runtimePackages();
        const missing = [...new Set(spawned.map((s) => s.binary))]
            .filter((binary) => binary in PROVIDED_BY)
            .filter((binary) => !installed.includes(PROVIDED_BY[binary]))
            .map((binary) => `${binary} needs ${PROVIDED_BY[binary]}`);
        expect(
            missing,
            `the runner stage installs ${JSON.stringify(installed)}`,
        ).toEqual([]);
    });
});
