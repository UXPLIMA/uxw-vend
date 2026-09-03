// Fails if any tracked text file contains an em dash (U+2014).
//
// This is a house style rule, not a correctness one: the project writes
// hyphens. It is a gate rather than a lint rule because em dashes turn up in
// JSON translations, Markdown docs, shell scripts and .env samples just as
// often as in TypeScript, and ESLint only sees the last of those.
//
// The Next.js agent-rules block in AGENTS.md is rewritten by `next dev` from a
// string inside the `next` package, so it is kept in line by
// scripts/patch-next-agent-rules.ts rather than being excluded here.

import { spawnSync } from "child_process";
import fs from "fs";

const EM_DASH = "—";

function trackedFiles(): string[] {
    const result = spawnSync("git", ["ls-files", "-z"], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
    if (result.status !== 0) {
        console.error("[no-em-dash] `git ls-files` failed; is this a git checkout?");
        process.exit(2);
    }
    return result.stdout.split("\0").filter(Boolean);
}

// A NUL in the first 8KB is how git itself decides a blob is binary. Reading
// the whole tree as UTF-8 would otherwise mangle the marketplace ZIPs.
function isBinary(buf: Buffer): boolean {
    return buf.subarray(0, 8192).includes(0);
}

const hits: string[] = [];

for (const file of trackedFiles()) {
    let buf: Buffer;
    try {
        buf = fs.readFileSync(file);
    } catch {
        continue; // deleted between ls-files and here
    }
    if (isBinary(buf) || !buf.includes(EM_DASH)) continue;

    buf.toString("utf-8").split("\n").forEach((line, i) => {
        if (line.includes(EM_DASH)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
}

if (hits.length > 0) {
    console.error(`[no-em-dash] ${hits.length} em dash${hits.length === 1 ? "" : "es"} found. Use a hyphen, a comma, or split the sentence.\n`);
    for (const hit of hits) console.error(`  ${hit}`);
    process.exit(1);
}

console.log("[no-em-dash] clean");
