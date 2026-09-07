import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The scheduler already knows how to report a failed job. One job took that
 * away from it.
 *
 * `runJob` wraps every handler: it catches, writes `lastStatus: "error"` and
 * the message into the job's `CronRun` row, and the admin observability screen
 * reads exactly those rows to show what is broken. A handler that catches its
 * own failure and returns normally is recorded as a success.
 *
 * `core:automated-backup` did that. It shells out to `pg_dump`, which is not
 * on the runtime image and not on this dev box, so the job has never once
 * produced a backup: `backups/` is empty and `CronRun` says `ok`, 35 ms, no
 * error. An operator reading the dashboard sees a healthy daily backup and has
 * none.
 *
 * A handler may still catch, as long as what it catches is not the failure of
 * the thing it exists to do. Rethrow, and let the wrapper record it.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCHEDULER = path.join(ROOT, "src/core/lib/scheduler.ts");

/** The body of each `registerCronJob({ ... })` call, brace matched. */
function cronJobBlocks(source: string): { key: string; body: string }[] {
    const blocks: { key: string; body: string }[] = [];
    const opener = /registerCronJob\(\{/g;
    for (let m = opener.exec(source); m; m = opener.exec(source)) {
        let depth = 0;
        let i = m.index + m[0].length - 1;
        const start = i;
        for (; i < source.length; i++) {
            if (source[i] === "{") depth++;
            else if (source[i] === "}" && --depth === 0) break;
        }
        const body = source.slice(start, i + 1);
        blocks.push({ key: /key:\s*"([^"]+)"/.exec(body)?.[1] ?? "unnamed", body });
    }
    return blocks;
}

/** A catch whose body never rethrows. */
function swallowsAFailure(body: string): boolean {
    const opener = /catch\s*(?:\([^)]*\))?\s*\{/g;
    for (let m = opener.exec(body); m; m = opener.exec(body)) {
        let depth = 0;
        let i = m.index + m[0].length - 1;
        const start = i;
        for (; i < body.length; i++) {
            if (body[i] === "{") depth++;
            else if (body[i] === "}" && --depth === 0) break;
        }
        if (!/\bthrow\b/.test(body.slice(start, i + 1))) return true;
    }
    return false;
}

describe("a scheduled job", () => {
    const jobs = cronJobBlocks(fs.readFileSync(SCHEDULER, "utf8"));

    it("finds the jobs core registers", () => {
        expect(jobs.length).toBeGreaterThanOrEqual(8);
        expect(jobs.map((j) => j.key)).toContain("core:automated-backup");
    });

    it("lets its failure reach the wrapper that records it", () => {
        const silent = jobs.filter((j) => swallowsAFailure(j.body)).map((j) => j.key);

        expect(
            silent,
            `These catch their own failure and return, so runJob writes lastStatus\n` +
            `"ok" and the observability screen shows them healthy:\n${silent.join("\n")}`,
        ).toEqual([]);
    });
});
